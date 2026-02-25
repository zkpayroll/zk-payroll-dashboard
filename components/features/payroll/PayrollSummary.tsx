"use client";

import { useMemo, useState } from "react";
import { generatePayrollProof } from "@/lib/zk";

interface ProofUiState {
	status: "idle" | "running" | "success" | "error";
	message?: string;
}

function PayrollSummary() {
	const [proofState, setProofState] = useState<ProofUiState>({
		status: "idle",
	});

	const proofToneClass = useMemo(() => {
		if (proofState.status === "success") {
			return "text-green-700";
		}

		if (proofState.status === "error") {
			return "text-red-700";
		}

		return "text-gray-600";
	}, [proofState.status]);

	const handleGenerateMockProof = async () => {
		setProofState({
			status: "running",
			message: "Generating local payroll proof...",
		});

		try {
			const result = await generatePayrollProof({
				merkleRoot: "0xmock_merkle_root",
				totalPayrollAmount: "124500",
				payrollPeriodId: "2026-02",
				employeeId: "emp-001",
				employeeSsn: "111-22-3333",
				salaryAmount: "8500",
				salt: "dashboard-demo-salt",
			});

			const commitment = String(result.proof.proof.commitment ?? "").slice(
				0,
				16,
			);
			const verificationLabel = result.verification.isValid
				? "verified"
				: "failed";

			setProofState({
				status: "success",
				message: `Mock proof ${verificationLabel}. commitment: ${commitment}...`,
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown proof error";
			setProofState({
				status: "error",
				message: `Proof generation failed: ${message}`,
			});
		}
	};

	return (
		<section className="space-y-6" aria-labelledby="payroll-summary-heading">
			<h2 id="payroll-summary-heading" className="sr-only">
				Payroll Summary
			</h2>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6" role="list">
				<article className="bg-white p-6 rounded-lg shadow-sm" role="listitem">
					<h3 className="text-sm font-medium text-gray-600">Total Payroll</h3>
					<p className="text-3xl font-bold text-gray-900 mt-2" aria-live="polite">$124,500</p>
					<span className="text-green-700 text-sm font-medium">
						+12% from last month
					</span>
				</article>
				<article className="bg-white p-6 rounded-lg shadow-sm" role="listitem">
					<h3 className="text-sm font-medium text-gray-600">
						Active Employees
					</h3>
					<p className="text-3xl font-bold text-gray-900 mt-2" aria-live="polite">48</p>
					<span className="text-gray-600 text-sm font-medium">
						2 new this week
					</span>
				</article>
				<article className="bg-white p-6 rounded-lg shadow-sm" role="listitem">
					<h3 className="text-sm font-medium text-gray-600">
						Pending Approvals
					</h3>
					<p className="text-3xl font-bold text-gray-900 mt-2" aria-live="polite">3</p>
					<span className="text-yellow-700 text-sm font-medium">
						Action required
					</span>
				</article>
			</div>

			<article className="bg-white p-6 rounded-lg shadow-sm space-y-3">
				<h3 className="text-lg font-semibold text-gray-900">
					Mock ZK Proof Generator
				</h3>
				<p className="text-sm text-gray-600">
					Runs proof generation locally in-browser with placeholder artifacts
					until final Soroban verifier deployment.
				</p>
				<button
					type="button"
					className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium disabled:opacity-60 focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
					onClick={handleGenerateMockProof}
					disabled={proofState.status === "running"}
					aria-live="polite"
				>
					{proofState.status === "running"
						? "Generating..."
						: "Generate Mock Payroll Proof"}
				</button>
				<p className={`text-sm ${proofToneClass}`} aria-live="polite" role="status">
					{proofState.message ?? "No proof generated yet."}
				</p>
			</article>
		</section>
	);
}
export default PayrollSummary;
