import { connection } from "next/server";
import { AdminPage } from "@/components/admin/admin-ui";
import { BookingsPanel } from "@/components/admin/bookings/bookings-panel";
import { AvailabilityPanel, TypesPanel } from "@/components/admin/bookings/setup-panels";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can, requireStaff } from "@/lib/admin/guard";
import { getAvailability, listBookingTypes, listBookings } from "@/lib/bookings/data";
import { crmStaff, listContacts } from "@/lib/crm/data";
import { contactName } from "@/lib/crm/types";
import { siteUrl } from "@/lib/notify/senders";

export const metadata = { title: "Bookings · Admin · Echo" };

// Appointments booked on the website or by staff, the appointment types on
// the public /book page, and weekly availability.
export default async function BookingsPage() {
  const staff = await requireStaff("crm.view");
  await connection();
  const [bookings, types, availability, people, contacts] = await Promise.all([listBookings(), listBookingTypes(), getAvailability(), crmStaff(), listContacts()]);
  const readOnly = !can(staff, "crm.manage");
  return (
    <AdminPage title="Bookings" description="Appointments from your booking page and the team, appointment types and availability." className="max-w-[96rem]">
      <Tabs defaultValue="bookings">
        <TabsList variant="line">
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="types">Appointment types</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings" className="pt-6">
          <BookingsPanel bookings={bookings} types={types} staff={people} timezone={availability.timezone} readOnly={readOnly} nowIso={new Date().toISOString()}
            people={contacts.map((c) => ({ id: c.id, name: contactName(c), email: c.email, phone: c.phone }))} />
        </TabsContent>
        <TabsContent value="types" className="pt-6"><TypesPanel types={types} staff={people} siteUrl={siteUrl("")} readOnly={readOnly} /></TabsContent>
        <TabsContent value="availability" className="pt-6"><AvailabilityPanel initial={availability} readOnly={readOnly} /></TabsContent>
      </Tabs>
    </AdminPage>
  );
}
