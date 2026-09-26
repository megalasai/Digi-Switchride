import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconHeadphones } from "@/components/icons";

export default function SupportPage() {
  return (
    <div>
      <PageHeader
        title="Customer Support"
        description="Tickets submitted via the mobile app"
      />
      <EmptyState
        icon={<IconHeadphones className="h-7 w-7" />}
        title="No tickets yet"
        description="Support tickets will appear here when customers submit them through the app. Integrate with Freshdesk or Zoho Desk for advanced ticketing."
      />
    </div>
  );
}
