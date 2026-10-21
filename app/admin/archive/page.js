"use client";

import AddAbstractView from "@/components/shared/AddAbstractView";

export default function AdminArchivePage() {
  return (
    <AddAbstractView
      defaultRole="admin"
      editBase="/admin/archive"
      subtitle="Add a completed BSIS capstone study to the institutional library."
    />
  );
}
