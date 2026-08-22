import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@omelora/sunrise";

const buttonVariants = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "destructive",
] as const;

const buttonSizes = ["sm", "md", "lg"] as const;

const badgeVariants = [
  "default",
  "primary",
  "secondary",
  "success",
  "warning",
  "destructive",
  "outline",
] as const;

const cardVariants = ["default", "elevated", "outline", "muted"] as const;

export default function SunrisePreviewPage() {
  return (
    <div className="min-h-screen bg-sunrise-gradient">
      <div className="mx-auto max-w-4xl space-y-12 px-4 py-12 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Sunrise Preview
          </h1>
          <p className="text-muted-foreground">
            Visual QA for @omelora/sunrise components.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Buttons</h2>
          <div className="space-y-6">
            {buttonSizes.map((size) => (
              <div key={size} className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Size: {size}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {buttonVariants.map((variant) => (
                    <Button key={`${variant}-${size}`} variant={variant} size={size}>
                      {variant}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Badges</h2>
          <div className="flex flex-wrap items-center gap-2">
            {badgeVariants.map((variant) => (
              <Badge key={variant} variant={variant}>
                {variant}
              </Badge>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Cards</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {cardVariants.map((variant) => (
              <Card key={variant} variant={variant}>
                <CardHeader>
                  <CardTitle>{variant} card</CardTitle>
                  <CardDescription>
                    Placeholder description for the {variant} card variant.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground">
                    Card content goes here. This is sample body copy for visual QA.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Inputs</h2>
          <div className="grid max-w-md gap-4">
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              hint="We'll never share your email."
            />
            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="Enter password"
              error
              hint="Password must be at least 8 characters."
            />
          </div>
        </section>
      </div>
    </div>
  );
}
