import { notFound } from "next/navigation";
import LookLine from "@/components/looks/LookLine";
import LookBrain from "@/components/looks/LookBrain";
import LookBoard from "@/components/looks/LookBoard";

export const metadata = { title: "A look · Digital Chef AI" };

export default async function LookPage({ params }: { params: Promise<{ look: string }> }) {
  const { look } = await params;
  if (look === "line") return <LookLine />;
  if (look === "brain") return <LookBrain />;
  if (look === "board") return <LookBoard />;
  notFound();
}
