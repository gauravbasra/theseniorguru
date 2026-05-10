import { getAdPlacement } from "@/lib/ads/ads";
import { listEvents } from "@/lib/events/events";
import { listProviders } from "@/lib/providers";

function titleCase(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getLocalSeoPage(state: string, city: string, category: string) {
  const cityName = titleCase(city);
  const stateCode = state.toUpperCase();
  const categoryName = titleCase(category);

  const [providers, events, placement] = await Promise.all([
    listProviders(),
    listEvents(),
    getAdPlacement("web.discover.top")
  ]);

  const matchingProviders = providers.filter((provider) => {
    const cityMatches = provider.city.toLowerCase().replaceAll(" ", "-") === city.toLowerCase();
    const stateMatches = provider.state.toLowerCase() === state.toLowerCase();
    const categoryMatches = provider.categories.some((item) =>
      item.toLowerCase().replaceAll(" ", "-").includes(category.toLowerCase())
    );

    return cityMatches && stateMatches && categoryMatches;
  });

  const nearbyEvents = events.filter((event) => {
    return event.city?.toLowerCase().replaceAll(" ", "-") === city.toLowerCase()
      && event.state?.toLowerCase() === state.toLowerCase();
  });

  return {
    cityName,
    stateCode,
    categoryName,
    providers: matchingProviders.length ? matchingProviders : providers,
    events: nearbyEvents,
    placement,
    faq: [
      {
        question: `How do I compare ${categoryName.toLowerCase()} options in ${cityName}?`,
        answer: "Compare source confidence, services, direct contact options, reviews, events, and whether a listing is claimed or verified."
      },
      {
        question: "Are providers paying to be listed?",
        answer: "Baseline listings and direct contact are free. Sponsored placements are labeled separately from organic listings."
      },
      {
        question: "Can providers update their listing?",
        answer: "Yes. Providers can claim their free profile, verify ownership, update information, publish events, and manage reviews."
      }
    ]
  };
}

