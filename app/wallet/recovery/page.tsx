import DashboardLayout from "@/components/layout/DashboardLayout";
import SigningFailureRecoveryCenter from "@/components/features/wallet/SigningFailureRecoveryCenter";

function SigningRecoveryPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Wallet Signing Recovery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Failed wallet signings grouped by cause, with retry guidance and safe next steps.
          </p>
        </div>
        <SigningFailureRecoveryCenter />
      </div>
    </DashboardLayout>
  );
}

export default SigningRecoveryPage;
