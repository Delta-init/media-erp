"use client";

import { Suspense, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import { ConnectorGrid } from "@/components/connectors/ConnectorGrid";
import { AddConnectorModal } from "@/components/connectors/AddConnectorModal";
import { OAuthCallback } from "@/components/connectors/OAuthCallback";
import { useConnectors } from "@/hooks/useConnectors";

function ConnectorsContent() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: connectors, isLoading } = useConnectors();

  return (
    <>
      <OAuthCallback />

      <PageHeader
        title="Connectors"
        subtitle="Manage your data source connections."
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add connector
          </Button>
        }
      />

      <div className="mt-6">
        <ConnectorGrid
          connectors={connectors}
          isLoading={isLoading}
          onAdd={() => setModalOpen(true)}
        />
      </div>

      <AddConnectorModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}

export default function ConnectorsPage() {
  return (
    <Suspense>
      <ConnectorsContent />
    </Suspense>
  );
}
