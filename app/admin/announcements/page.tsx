import { getCmsContent } from "@/services/cms/cms-service";
import { AnnouncementsEditor } from "./announcements-editor";

type AnnouncementItem = {
  id: string;
  message: string;
  href: string;
  active: boolean;
  order: number;
  durationMs: number;
};

const DEFAULT_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: "announcement-1",
    message: "Complimentary shipping on orders over PKR 15,000",
    href: "",
    active: true,
    order: 1,
    durationMs: 5000,
  },
  {
    id: "announcement-2",
    message: "New arrivals — Jamawar & Cut-Dana embroidery now online",
    href: "",
    active: true,
    order: 2,
    durationMs: 5000,
  },
  {
    id: "announcement-3",
    message: "Subscribe for early access to the seasonal collection",
    href: "",
    active: true,
    order: 3,
    durationMs: 5000,
  },
];

export default async function AnnouncementsPage() {
  const raw = await getCmsContent("announcements");

  const announcements: AnnouncementItem[] = Array.isArray(raw)
    ? (raw as AnnouncementItem[])
    : DEFAULT_ANNOUNCEMENTS;

  return <AnnouncementsEditor announcements={announcements} />;
}
