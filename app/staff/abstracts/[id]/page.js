"use client";

import { use } from "react";
import EditAbstractView from "@/components/shared/EditAbstractView";

export default function StaffEditAbstractPage({ params }) {
  const { id } = use(params);
  return (
    <EditAbstractView
      id={id}
      defaultRole="staff"
      backHref="/staff/abstracts"
      backLabel="Back to My Abstracts"
      ownOnly
    />
  );
}
