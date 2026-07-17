import {
  HugeiconsIcon,
  type HugeiconsIconProps,
} from "@hugeicons/react"

function HugeIcon({ strokeWidth = 1.8, ...props }: HugeiconsIconProps) {
  return <HugeiconsIcon strokeWidth={strokeWidth} {...props} />
}

export { HugeIcon }
export type { HugeiconsIconProps as HugeIconProps }
