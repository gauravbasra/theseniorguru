import { getAdPlacement } from "@/lib/ads/ads";
import { listEvents } from "@/lib/events/events";
import { getProviderById } from "@/lib/providers";
import { listProviderReviews } from "@/lib/reviews/reviews";

export async function getProviderProfile(slugOrId: string) {
  const provider = await getProviderById(slugOrId);

  if (!provider) {
    return null;
  }

  const [events, reviews, placement] = await Promise.all([
    listEvents(),
    listProviderReviews(provider.id),
    getAdPlacement("web.discover.top")
  ]);

  return {
    provider,
    events: events.filter((event) => event.providerId === provider.id),
    reviews,
    placement,
    trustSignals: [
      {
        label: "Source confidence",
        value: `${Math.round(provider.confidenceScore * 100)}%`
      },
      {
        label: "Listing status",
        value: provider.status.replaceAll("_", " ")
      },
      {
        label: "Contact model",
        value: "Direct contact is free"
      }
    ]
  };
}

