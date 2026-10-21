"use client";

import { use } from "react";
import EditAbstractView from "@/components/shared/EditAbstractView";

export default function EditAbstractPage({ params }) {
  const { id } = use(params);
  return <EditAbstractView id={id} defaultRole="admin" backHref="/admin/archive" backLabel="Back to Archive" />;
}
