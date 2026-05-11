import type { DataSourceRecord, ProviderRecord } from "@/lib/domain/providers";

export const seedDataSources: DataSourceRecord[] = [
  {
    id: "seed-cms-care-compare",
    name: "CMS Care Compare",
    sourceType: "cms",
    baseUrl: "https://data.cms.gov/",
    jurisdiction: "US",
    reviewStatus: "approved",
    termsNotes: "Official federal provider data source for launch ingestion planning.",
    approvedAt: "2026-05-10T00:00:00.000Z"
  },
  {
    id: "seed-current-senior-guru-public-index",
    name: "TheSeniorGuru.com current public listing index",
    sourceType: "manual",
    baseUrl: "https://theseniorguru.com/search",
    jurisdiction: "US",
    reviewStatus: "approved",
    robotsStatus: "allowed",
    termsNotes:
      "Owner-controlled public listing index. Images are staged as source metadata pending storage and reuse review.",
    approvedAt: "2026-05-11T00:00:00.000Z"
  }
];

export const seedProviders: ProviderRecord[] = [
  {
    id: "seed-cottages-dayton-place",
    name: "The Cottages at Dayton Place",
    slug: "the-cottages-at-dayton-place",
    status: "verified_by_source",
    categories: ["Senior Living", "Assisted Living"],
    address: "2032 South Dayton Court",
    city: "Denver",
    state: "CO",
    phone: "720-881-1543",
    imageUrl: "https://images.unsplash.com/photo-1551038247-3d9af20df552?auto=format&fit=crop&w=1000&q=82",
    summary: "A Denver senior living option surfaced from the current Senior Guru marketplace inventory.",
    confidenceScore: 0.92,
    source: {
      name: "Current Senior Guru inventory",
      url: "https://theseniorguru.com",
      fetchedAt: "2026-05-10T00:00:00.000Z",
      confidence: 0.92
    }
  },
  {
    id: "seed-brookdale-lowry",
    name: "Brookdale Lowry",
    slug: "brookdale-lowry",
    status: "verified_by_source",
    categories: ["Senior Living", "Assisted Living"],
    address: "150 Quebec Street",
    city: "Denver",
    state: "CO",
    phone: "720-881-1543",
    imageUrl: "https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=1000&q=82",
    summary: "Denver senior living listing with direct discovery, profile claiming, and future reviews workflow.",
    confidenceScore: 0.9,
    source: {
      name: "Current Senior Guru inventory",
      url: "https://theseniorguru.com",
      fetchedAt: "2026-05-10T00:00:00.000Z",
      confidence: 0.9
    }
  },
  {
    id: "seed-touching-hearts-mckinney",
    name: "Touching Hearts at Home McKinney",
    slug: "touching-hearts-at-home-mckinney",
    status: "verified_by_source",
    categories: ["Home Health & Hospice", "Home Care"],
    address: "5900 S Lake Forest Dr Ste 300",
    city: "McKinney",
    state: "TX",
    phone: "720-881-1543",
    imageUrl: "https://images.unsplash.com/photo-1576765608866-5b51f0049b2c?auto=format&fit=crop&w=1000&q=82",
    summary: "Home care services listing brought forward from the current public Senior Guru directory.",
    confidenceScore: 0.88,
    source: {
      name: "Current Senior Guru inventory",
      url: "https://theseniorguru.com",
      fetchedAt: "2026-05-10T00:00:00.000Z",
      confidence: 0.88
    }
  },
  {
    id: "seed-casa-redonda-vigil",
    name: "Casa Redonda de Vigil Apartments",
    slug: "casa-redonda-de-vigil-apartments",
    status: "verified_by_source",
    categories: ["Housing", "Senior Apartments"],
    address: "1080 W 69th Ave",
    city: "Denver",
    state: "CO",
    phone: "720-881-1543",
    imageUrl: "https://images.unsplash.com/photo-1560185008-a33f5c7b1844?auto=format&fit=crop&w=1000&q=82",
    summary: "Senior housing inventory for families comparing location, category, and contact options.",
    confidenceScore: 0.86,
    source: {
      name: "Current Senior Guru inventory",
      url: "https://theseniorguru.com",
      fetchedAt: "2026-05-10T00:00:00.000Z",
      confidence: 0.86
    }
  },
  {
    id: "seed-overture-9th-co",
    name: "Overture 9th & CO 55 Plus Apartment Homes",
    slug: "overture-9th-and-co-55-plus-apartment-homes",
    status: "verified_by_source",
    categories: ["Housing", "55 Plus Apartments"],
    address: "4205 E 10th Ave",
    city: "Denver",
    state: "CO",
    phone: "720-881-1543",
    imageUrl: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1000&q=82",
    summary: "55+ housing option listed in the existing marketplace, now available to the new discovery engine.",
    confidenceScore: 0.86,
    source: {
      name: "Current Senior Guru inventory",
      url: "https://theseniorguru.com",
      fetchedAt: "2026-05-10T00:00:00.000Z",
      confidence: 0.86
    }
  },
  {
    id: "seed-brightview-holmdel",
    name: "Brightview Senior Living - Holmdel",
    slug: "brightview-senior-living-holmdel",
    status: "verified_by_source",
    categories: ["Senior Living", "Independent Living", "Assisted Living", "Memory Care"],
    address: "2135 NJ-35 Holmdel, NJ 07733",
    city: "Holmdel",
    state: "NJ",
    zip: "07733",
    phone: "720-881-1543",
    websiteUrl: "https://theseniorguru.com/listing/senior-living/brightview-senior-living---holmdel",
    imageUrl: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=82",
    priceLabel: "$4,000.00 /per month",
    summary:
      "Independent living, assisted living, and memory care community in Monmouth County with dining, wellness, and daily programs.",
    confidenceScore: 0.94,
    source: {
      name: "Current Senior Guru inventory",
      url: "https://theseniorguru.com/listing/senior-living/brightview-senior-living---holmdel",
      fetchedAt: "2026-05-10T00:00:00.000Z",
      confidence: 0.94
    }
  },
  {
    id: "seed-the-bentley",
    name: "The Bentley",
    slug: "the-bentley",
    status: "verified_by_source",
    categories: ["Senior Living"],
    address: "3362 Forest Lane",
    city: "Dallas",
    state: "GA",
    phone: "720-881-1543",
    imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=82",
    summary: "Senior living listing from the current marketplace, ready for claim and profile enrichment.",
    confidenceScore: 0.84,
    source: {
      name: "Current Senior Guru inventory",
      url: "https://theseniorguru.com",
      fetchedAt: "2026-05-10T00:00:00.000Z",
      confidence: 0.84
    }
  },
  {
    id: "seed-atria-carrollton",
    name: "Atria Carrollton",
    slug: "atria-carrollton",
    status: "verified_by_source",
    categories: ["Senior Living"],
    address: "1825 Arbor Creek",
    city: "Carrollton",
    state: "GA",
    phone: "720-881-1543",
    imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=82",
    summary: "A current Senior Guru senior living listing prepared for the new free-contact marketplace.",
    confidenceScore: 0.84,
    source: {
      name: "Current Senior Guru inventory",
      url: "https://theseniorguru.com",
      fetchedAt: "2026-05-10T00:00:00.000Z",
      confidence: 0.84
    }
  },
  {
    id: "seed-brightview-alexandria",
    name: "Brightview Senior Living - Alexandria",
    slug: "brightview-senior-living-alexandria",
    status: "verified_by_source",
    categories: ["Senior Living", "Assisted Living", "Memory Care"],
    address: "6507 Telegraph Road",
    city: "Alexandria",
    state: "VA",
    zip: "22310",
    phone: "720-881-1543",
    imageUrl: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1000&q=82",
    priceLabel: "$5,675.00 /per month",
    summary: "Latest-listing inventory from the current website, included for richer national marketplace coverage.",
    confidenceScore: 0.9,
    source: {
      name: "Current Senior Guru inventory",
      url: "https://theseniorguru.com",
      fetchedAt: "2026-05-10T00:00:00.000Z",
      confidence: 0.9
    }
  }
];
