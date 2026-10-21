"use client";

import AddAbstractView from "@/components/shared/AddAbstractView";

export default function StaffAddPage() {
  return (
    <AddAbstractView
      defaultRole="staff"
      editBase="/staff/abstracts"
      mineOnly
      subtitle="Add a completed BSIS capstone study. Your name is recorded on every abstract you add."
    />
  );
}
