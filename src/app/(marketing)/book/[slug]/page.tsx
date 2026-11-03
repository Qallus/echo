import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PublicType } from "../actions";
import { Booker } from "./booker";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Book · Echo`, alternates: { canonical: `/book/${slug}` } };
}

export default async function BookType({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("booking_type_public", { p_slug: slug }).maybeSingle<PublicType>();
  if (!data) notFound();
  return <Booker type={data} />;
}
