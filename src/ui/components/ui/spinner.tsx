import { Loading03Icon } from "@hugeicons/core-free-icons"

import { HugeIcon, type HugeIconProps } from "@/components/ui/huge-icon"
import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: Omit<HugeIconProps, "icon">) {
  return (
    <HugeIcon icon={Loading03Icon} data-slot="spinner" role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
