import { redirect } from "next/navigation";

// `/dashboard` is the canonical home (PWA start_url + nav target). The root
// path just forwards there so we don't mount two copies of the Dashboard.
export default function HomePage() {
  redirect("/dashboard");
}
