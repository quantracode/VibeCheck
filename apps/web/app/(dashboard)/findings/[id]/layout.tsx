// Generate a placeholder to enable static export
// Actual finding pages are rendered client-side with client-side navigation
export function generateStaticParams() {
  // Return a placeholder ID - the actual routes work via client-side navigation
  // from the findings list page. Direct URL access to unknown IDs will show
  // the "Finding not found" message which is appropriate behavior.
  return [{ id: "placeholder" }];
}

export default function FindingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
