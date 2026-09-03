var CACHE = "khata-v10";
var SHARE = "khata-share";
var FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) {
      return (k === CACHE || k === SHARE) ? null : caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

// Android hands a shared SMS or screenshot to us as a POST. Stash it, then
// redirect to the app, which picks it up and clears it.
function handleShare(request) {
  return request.formData().then(function (form) {
    var text = [form.get("title"), form.get("text"), form.get("url")]
      .filter(Boolean).join("\n");
    var shot = form.get("shot");
    return caches.open(SHARE).then(function (c) {
      var jobs = [c.put("shared-text", new Response(text || ""))];
      if (shot && shot.size) jobs.push(c.put("shared-shot", new Response(shot)));
      else jobs.push(c.delete("shared-shot"));
      return Promise.all(jobs);
    });
  }).then(function () {
    return Response.redirect("./?shared=1", 303);
  }).catch(function () {
    return Response.redirect("./", 303);
  });
}

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method === "POST" && url.pathname.endsWith("/share")) {
    e.respondWith(handleShare(e.request));
    return;
  }
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (r) {
        return r || caches.match("./index.html");
      });
    })
  );
});
