/* ============================================================================
   github.js — GitHub REST client + the deploy pipeline.

   Runs entirely in the browser. api.github.com sends permissive CORS headers
   (Access-Control-Allow-Origin: *) and accepts the Authorization header, so no
   backend is needed. Endpoints/version verified against API 2022-11-28.
   ==========================================================================*/
(function (ND) {
  "use strict";

  const cfg = ND.config;

  // Live rate-limit snapshot, refreshed from response headers on every call.
  ND.rate = { remaining: null, limit: null, reset: null };

  async function request(path, opts) {
    opts = opts || {};
    const url = path.indexOf("http") === 0 ? path : cfg.API + path;
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": cfg.API_VERSION,
    };
    if (opts.token) headers.Authorization = "Bearer " + opts.token;
    let body;
    if (opts.body != null) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }

    let res;
    try {
      res = await fetch(url, { method: opts.method || "GET", headers: headers, body: body });
    } catch (e) {
      const err = new Error(ND.t("err.network"));
      err.kind = "network";
      throw err;
    }

    const rem = res.headers.get("x-ratelimit-remaining");
    const lim = res.headers.get("x-ratelimit-limit");
    const rst = res.headers.get("x-ratelimit-reset");
    if (rem !== null) ND.rate.remaining = Number(rem);
    if (lim !== null) ND.rate.limit = Number(lim);
    if (rst !== null) ND.rate.reset = Number(rst);
    if (typeof ND.onRate === "function") ND.onRate(ND.rate);

    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (_) { data = text; } }

    if (!res.ok) {
      const err = new Error(friendlyMessage(res.status, data));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function friendlyMessage(status, data) {
    const raw = (data && data.message) ? data.message : "";
    // GitHub push protection: a file contains a secret (token/key). Can arrive as
    // 422 or 409 depending on the path, so match the message, not just the code.
    if (/secret|GH013|push protection|repository rule violations/i.test(raw)) {
      return ND.t("err.secret");
    }
    switch (status) {
      case 401: return ND.t("err.401");
      case 403:
        if (ND.rate.remaining === 0) return ND.t("err.403.rate");
        return ND.t("err.403.generic");
      case 404: return ND.t("err.404");
      case 422: return raw || ND.t("err.422");
      default:  return raw || ND.t("err.default", { status: status });
    }
  }

  const gh = {
    getUser(token) {
      return request("/user", { token: token });
    },
    createRepo(token, o) {
      return request("/user/repos", {
        method: "POST", token: token,
        body: { name: o.name, description: o.description || "", private: !!o.isPrivate, auto_init: true },
      });
    },
    getRepo(token, owner, repo) {
      return request("/repos/" + owner + "/" + repo, { token: token });
    },
    getRef(token, owner, repo, branch) {
      return request("/repos/" + owner + "/" + repo + "/git/ref/heads/" + branch, { token: token });
    },
    createBlob(token, owner, repo, base64) {
      return request("/repos/" + owner + "/" + repo + "/git/blobs", {
        method: "POST", token: token, body: { content: base64, encoding: "base64" },
      });
    },
    createTree(token, owner, repo, tree, baseTree) {
      const body = { tree: tree };
      if (baseTree) body.base_tree = baseTree;
      return request("/repos/" + owner + "/" + repo + "/git/trees", {
        method: "POST", token: token, body: body,
      });
    },
    createCommit(token, owner, repo, o) {
      return request("/repos/" + owner + "/" + repo + "/git/commits", {
        method: "POST", token: token,
        body: { message: o.message, tree: o.tree, parents: o.parents || [] },
      });
    },
    updateRef(token, owner, repo, branch, sha) {
      return request("/repos/" + owner + "/" + repo + "/git/refs/heads/" + branch, {
        method: "PATCH", token: token, body: { sha: sha, force: true },
      });
    },
    createRefNew(token, owner, repo, branch, sha) {
      return request("/repos/" + owner + "/" + repo + "/git/refs", {
        method: "POST", token: token, body: { ref: "refs/heads/" + branch, sha: sha },
      });
    },
    enablePages(token, owner, repo, branch) {
      return request("/repos/" + owner + "/" + repo + "/pages", {
        method: "POST", token: token, body: { source: { branch: branch, path: "/" } },
      });
    },
    getPages(token, owner, repo) {
      return request("/repos/" + owner + "/" + repo + "/pages", { token: token });
    },
  };
  ND.gh = gh;

  // Resolve the current head commit of a branch, retrying briefly because
  // auto_init's first commit can lag right after repo creation. Returns null for
  // an empty repo (no commits yet) so the caller commits without a parent.
  async function resolveBase(token, owner, repo, branch) {
    for (let i = 0; i < 5; i++) {
      try {
        const ref = await gh.getRef(token, owner, repo, branch);
        return { commitSha: ref.object.sha };
      } catch (e) {
        if (e.status === 404 || e.status === 409) {
          if (i < 4) { await ND.util.sleep(1200); continue; }
          return null; // genuinely empty repository
        }
        throw e;
      }
    }
    return null;
  }

  /* Full pipeline. `files` is [{ path, file }]. `log(msg, type)` streams
     progress lines; `setStep(name)` advances the stepper. Returns the result. */
  ND.deploy = async function deploy(token, opts, log, setStep) {
    const files = opts.files;
    const repoName = opts.repoName;

    setStep("connect");
    log(ND.t("log.auth"), "step");
    const user = await gh.getUser(token);
    const owner = user.login;
    log(ND.t("log.signedIn", { owner: owner }), "ok");

    setStep("repo");
    let repo, created = false;
    try {
      log(ND.t("log.creatingRepo", { repo: repoName }), "step");
      repo = await gh.createRepo(token, { name: repoName, description: opts.description, isPrivate: opts.isPrivate });
      created = true;
      log(ND.t("log.repoCreated"), "ok");
    } catch (e) {
      if (e.status === 422) {
        log(ND.t("log.repoExists", { repo: repoName }), "warn");
        repo = await gh.getRepo(token, owner, repoName);
      } else {
        throw e;
      }
    }
    const branch = repo.default_branch || "main";

    setStep("upload");
    const base = await resolveBase(token, owner, repoName, branch);

    log(ND.t("log.uploading", { n: files.length, s: files.length === 1 ? "" : "s" }), "step");
    const tree = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const b64 = await ND.util.fileToBase64(f.file);
      const blob = await gh.createBlob(token, owner, repoName, b64);
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
      log("  + " + f.path);
    }

    log(ND.t("log.buildingCommit"), "step");
    // No base_tree: the commit's tree is exactly the user's files, so a redeploy
    // fully replaces the site (no stale files) and the auto_init README drops out.
    const newTree = await gh.createTree(token, owner, repoName, tree, null);
    const commit = await gh.createCommit(token, owner, repoName, {
      message: cfg.COMMIT_MESSAGE,
      tree: newTree.sha,
      parents: base ? [base.commitSha] : [],
    });
    if (base) await gh.updateRef(token, owner, repoName, branch, commit.sha);
    else await gh.createRefNew(token, owner, repoName, branch, commit.sha);
    log(ND.t("log.committed", { branch: branch }), "ok");

    setStep("pages");
    log(ND.t("log.enablingPages"), "step");
    try {
      await gh.enablePages(token, owner, repoName, branch);
      log(ND.t("log.pagesEnabled"), "ok");
    } catch (e) {
      if (e.status === 409) {
        log(ND.t("log.pagesAlready"), "warn");
      } else if (e.status === 403 || e.status === 422) {
        throw new Error(ND.t("err.pagesPublic"));
      } else {
        throw e;
      }
    }

    log(ND.t("log.waitingBuild"), "step");
    const computed = "https://" + owner + ".github.io/" + repoName + "/";
    let pagesUrl = computed, built = false;
    for (let i = 0; i < cfg.POLL_MAX; i++) {
      await ND.util.sleep(cfg.POLL_INTERVAL);
      let p;
      try { p = await gh.getPages(token, owner, repoName); }
      catch (_) { continue; }
      if (p && p.html_url) pagesUrl = p.html_url;
      if (p && p.status === "built") { built = true; break; }
      if (p && p.status === "errored") {
        throw new Error(ND.t("err.pagesFailed"));
      }
      log(ND.t("log.buildStatus", { status: (p && p.status) || "queued" }), "poll");
    }

    if (built) log(ND.t("log.siteLive"), "ok");
    else log(ND.t("log.stillBuilding"), "warn");

    setStep("done");
    return {
      owner: owner, repoName: repoName, branch: branch,
      repoUrl: repo.html_url || ("https://github.com/" + owner + "/" + repoName),
      pagesUrl: pagesUrl, built: built, created: created,
    };
  };
})(window.ND);
