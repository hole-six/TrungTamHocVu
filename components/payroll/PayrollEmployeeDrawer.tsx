"use client";

import ResponsiveDrawer from "@/components/ui/ResponsiveDrawer";
import PayrollEmployeeEditPanels from "@/components/payroll/PayrollEmployeeEditPanels";

type PayrollEmployeeEditPanelsProps = React.ComponentProps<typeof PayrollEmployeeEditPanels>;

export default function PayrollEmployeeDrawer({
  open,
  onClose,
  ...panelProps
}: PayrollEmployeeEditPanelsProps & { open: boolean; onClose: () => void }) {
  return (
    <ResponsiveDrawer       open={open}
      onClose={onClose}
      title={panelProps.headerSummary.fullName}
      description="Sửa toàn bộ thông tin, đơn giá, dòng lương và chấm công của người này trong một chỗ."
      widthClassName="max-w-3xl"
    >
      <PayrollEmployeeEditPanels {...panelProps} />
    </ResponsiveDrawer>
  );
}
