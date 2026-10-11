"use client";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { markNotificationReadAction } from "@/modules/notifications/server/actions";
import { listNotifications } from "@/modules/notifications/server/queries";

export function NotificationBell({ orgSlug }: { orgSlug: string }) {
  const [data, setData] = useState<
    Awaited<ReturnType<typeof listNotifications>>
  >({ unreadCount: 0, latest: [] });
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let active = true;
    listNotifications({ orgSlug })
      .then((result) => {
        if (active) {
          setData(result);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setError("Unable to load notifications.");
      });
    return () => {
      active = false;
    };
  }, [orgSlug]);
  const reload = () =>
    startTransition(async () => {
      try {
        setData(await listNotifications({ orgSlug }));
        setLoaded(true);
        setError(undefined);
      } catch {
        setError("Unable to load notifications.");
      }
    });
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) reload();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={`Notifications, ${data.unreadCount} unread`}
        >
          <Bell />
          {data.unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
              {data.unreadCount > 9 ? "9+" : data.unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-96 w-80 overflow-y-auto"
      >
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {error ? (
          <p role="alert" className="px-2 text-sm text-destructive">
            {error}
          </p>
        ) : !loaded ? (
          <output className="px-2 text-sm">Loading notifications...</output>
        ) : data.latest.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No notifications</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          data.latest.map((notification) => (
            <Item
              key={notification.id}
              size="sm"
              variant={notification.read ? "default" : "muted"}
            >
              <ItemContent>
                <DropdownMenuItem asChild>
                  <Link href={notification.href}>
                    <ItemTitle>{notification.title}</ItemTitle>
                  </Link>
                </DropdownMenuItem>
                <ItemDescription>{notification.body}</ItemDescription>
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          const result = await markNotificationReadAction({
                            orgSlug,
                            id: notification.id,
                          });
                          if (result.error) {
                            setError(result.error);
                            return;
                          }
                          setData(await listNotifications({ orgSlug }));
                          setError(undefined);
                        } catch {
                          setError("Unable to mark notification as read.");
                        }
                      })
                    }
                  >
                    Mark as read
                  </Button>
                )}
              </ItemContent>
            </Item>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
