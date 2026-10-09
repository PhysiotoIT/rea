/** Accept one public HTTPS YouTube video without import-time I/O. */
export function videoIdentity(input) {
  const url = new URL(input);
  if (url.protocol !== "https:") throw new Error("Use an HTTPS YouTube URL.");
  if (url.username || url.password)
    throw new Error("Credentials in URLs are unsupported.");
  let id;
  if (url.hostname === "youtu.be") id = url.pathname.slice(1);
  else if (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
  ) {
    id =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/u)?.[1];
  }
  if (!id || !/^[\w-]{11}$/u.test(id))
    throw new Error("Expected one valid YouTube video URL.");
  return { video_id: id, url: "https://www.youtube.com/watch?v=" + id };
}
