import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/components/PrintButton";
import InvoiceDocument from "@/components/tuition/InvoiceDocument";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: { chargeId: string };
  searchParams?: { autoprint?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const charge = await prisma.charge.findUnique({
    where: { id: params.chargeId },
    include: {
      student: true,
      class: { include: { branch: true } },
      billingPeriod: true,
      allocations: true,
      invoice: true,
    },
  });
  if (!charge) notFound();

  let invoice = charge.invoice;
  if (!invoice) {
    const invoiceNo = `INV${charge.billingPeriod.periodName.replace("-", "")}${charge.id.slice(0, 6).toUpperCase()}`;
    invoice = await prisma.invoice.create({ data: { chargeId: charge.id, invoiceNo } });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8 print:p-0">
      {searchParams?.autoprint === "1" ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('load', function () {
                setTimeout(function () { window.print(); }, 250);
              });
            `,
          }}
        />
      ) : null}

      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">Hóa đơn học phí</h1>
        <PrintButton />
      </div>

      <InvoiceDocument charge={{ ...charge, invoice }} />
    </div>
  );
}
