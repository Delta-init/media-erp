"use client";

import { motion } from "framer-motion";
import { Cable } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectorCard } from "@/components/shared/ConnectorCard";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { listVariants, listItemVariants } from "@/lib/animations";
import type { Connector } from "@/types/connector";

interface Props {
  connectors: Connector[] | undefined;
  isLoading: boolean;
  onAdd: () => void;
}

export function ConnectorGrid({ connectors, isLoading, onAdd }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <LoadingSkeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!connectors?.length) {
    return (
      <EmptyState
        icon={Cable}
        title="No connectors yet"
        description="Add your first data source to start pulling marketing data."
        action={<Button onClick={onAdd}>Add connector</Button>}
      />
    );
  }

  return (
    <motion.div
      variants={listVariants}
      initial="initial"
      animate="animate"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {connectors.map((c) => (
        <motion.div key={c.id} variants={listItemVariants}>
          <ConnectorCard connector={c} />
        </motion.div>
      ))}
    </motion.div>
  );
}
