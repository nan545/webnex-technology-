export type Product = {
  slug: "stockflow" | "stayflex";
  name: "StockFlow" | "STAYFLEX";
  category: string;
  description: string;
  capabilities: string[];
};

export const products: Product[] = [
  {
    slug: "stockflow",
    name: "StockFlow",
    category: "Inventory and business management",
    description: "A business software concept for inventory, sales, and operational management.",
    capabilities: ["Inventory records", "Sales workflows", "Business activity visibility", "Operational reporting"],
  },
  {
    slug: "stayflex",
    name: "STAYFLEX",
    category: "Hotel management software",
    description: "A hotel operations solution for reservations, rooms, guests, and hospitality teams.",
    capabilities: ["Reservation workflows", "Room and occupancy records", "Guest administration", "Operational reporting"],
  },
];
