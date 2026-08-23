import { requestUrl } from "obsidian";

export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration?: string;
  viewCount?: string;
  publishedTime?: string;
}

interface YouTubeInitialData {
  contents?: {
    twoColumnSearchResultsRenderer?: {
      primaryContents?: {
        sectionListRenderer?: {
          contents?: Array<{
            itemSectionRenderer?: {
              contents?: Array<{
                videoRenderer?: {
                  videoId?: string;
                  title?: { runs?: Array<{ text?: string }> };
                  ownerText?: { runs?: Array<{ text?: string }> };
                  lengthText?: { simpleText?: string };
                  viewCountText?: { simpleText?: string };
                  publishedTimeText?: { simpleText?: string };
                  thumbnail?: { thumbnails?: Array<{ url?: string }> };
                };
              }>;
            };
          }>;
        };
      };
    };
  };
}

interface InvidiousVideo {
  videoId?: string;
  title?: string;
  author?: string;
  lengthSeconds?: number;
  viewCount?: number;
}

export class YouTubeService {
  /**
   * Search for educational and tutorial videos on YouTube
   */
  async searchVideos(query: string): Promise<YouTubeVideoResult[]> {
    const results: YouTubeVideoResult[] = [];
    const cleanQuery = query.trim();
    if (!cleanQuery) return results;

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery + " tutorial explained")}`;

    try {
      const res = await requestUrl({
        url: searchUrl,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (res.status === 200 && res.text) {
        // Extract ytInitialData JSON from HTML
        const match = res.text.match(/ytInitialData\s*=\s*({.+?});/);

        if (match && match[1]) {
          const data = JSON.parse(match[1]) as YouTubeInitialData;
          const contents =
            data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

          if (Array.isArray(contents)) {
            for (const item of contents) {
              const video = item.videoRenderer;
              if (video && video.videoId) {
                const title = video.title?.runs?.[0]?.text || "Video";
                const channelName = video.ownerText?.runs?.[0]?.text || "";
                const duration = video.lengthText?.simpleText || "";
                const viewCount = video.viewCountText?.simpleText || "";
                const publishedTime = video.publishedTimeText?.simpleText || "";
                const thumbnails = video.thumbnail?.thumbnails;
                const thumbnailUrl =
                  (thumbnails && thumbnails.length > 0 ? thumbnails[thumbnails.length - 1]?.url : undefined) ||
                  `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;

                results.push({
                  videoId: video.videoId,
                  title,
                  channelName,
                  thumbnailUrl,
                  duration,
                  viewCount,
                  publishedTime,
                });

                if (results.length >= 8) break;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("[SmartLookup] YouTube search parser error, using fallback API:", err);
    }

    // Fallback: Invidious Public API if initial data parsing failed
    if (results.length === 0) {
      try {
        const invidiousUrl = `https://invidious.privacydev.net/api/v1/search?q=${encodeURIComponent(cleanQuery + " explained")}&type=video`;
        const invRes = await requestUrl({ url: invidiousUrl, method: "GET" });
        const invData = invRes.json as InvidiousVideo[] | undefined;
        if (invRes.status === 200 && Array.isArray(invData)) {
          invData.slice(0, 8).forEach((v) => {
            if (v.videoId) {
              results.push({
                videoId: v.videoId,
                title: v.title || "Video",
                channelName: v.author || "",
                thumbnailUrl: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                duration: v.lengthSeconds ? `${Math.floor(v.lengthSeconds / 60)}:${v.lengthSeconds % 60}` : undefined,
                viewCount: v.viewCount ? `${v.viewCount} views` : undefined,
              });
            }
          });
        }
      } catch {
        // ignore
      }
    }

    return results;
  }
}
