import { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Refresh01Icon, Settings01Icon } from "@hugeicons/core-free-icons";

import { Badge, Button } from "./basecoat";

interface TopBarProps {
  title: string;
  updated: string;
  isFetching: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export function TopBar({ title, updated, isFetching, onRefresh, onOpenSettings }: TopBarProps) {
  const updatedLabel = useMemo(() => {
    const date = new Date(updated);
    if (Number.isNaN(date.getTime())) {
      return "unknown";
    }

    return date.toLocaleString();
  }, [updated]);

  return (
    <div className="relative flex flex-col gap-6 pb-2 sm:pb-4">
      <div className="flex items-start gap-4">

        <span className="self-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="size-12" fill="none" viewBox="0 0 498 498">
            <path fill="#8b5dff" d="M396.19 0H101.259C45.335 0 0 45.346 0 101.283v295.001c0 55.937 45.335 101.283 101.259 101.283H396.19c55.924 0 101.259-45.346 101.259-101.283V101.283C497.449 45.346 452.114 0 396.19 0" />
            <path fill="#fff" fillRule="evenodd" d="M311.585 295.386c0 22.03-46.56 46.67-108.893 46.67-62.337 0-108.9-24.64-108.9-46.67v-43.324c25.263 17.175 63.969 27.767 108.9 27.767s83.63-10.592 108.893-27.767zm108.901-77.783h-31.114c-27.503 0-46.67-8.198-46.67-15.556 0-44.352-60.186-77.783-140.011-77.783-79.821 0-140.01 33.429-140.01 77.783v93.337c0 44.352 60.189 77.783 140.01 77.783 59.891 0 108.723-18.821 129.384-46.965 12.662 9.848 30.256 15.852 49.967 15.852h38.441c8.603 0 15.556-6.968 15.556-15.556V233.16c0-8.586-6.953-15.557-15.556-15.557z" clipRule="evenodd" />
          </svg>
          <span className="sr-only">Cora</span>
        </span>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={isFetching ? "warning" : "success"}
              className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em]"
            >
              {isFetching ? "Syncing" : "Live"}
            </Badge>
            <p className="text-sm text-zinc-500">{updatedLabel}</p>
          </div>

          <h1 className="max-w-4xl font-display text-4xl font-semibold tracking-[-0.05em] text-black dark:text-white sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            Live data surface for widgets, sources, and agent-driven updates.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:absolute md:right-0 md:top-0 md:justify-end">
        <Button variant="secondary" onClick={onRefresh} isLoading={isFetching} loadingText="Refreshing">
          <HugeiconsIcon icon={Refresh01Icon} size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
          Refresh
        </Button>
        <Button variant="secondary" onClick={onOpenSettings}>
          <HugeiconsIcon icon={Settings01Icon} size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
          Settings
        </Button>
      </div>
    </div>
  );
}
