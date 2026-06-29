"use client";

import { useState, useEffect } from "react";
import StepWallet from "./steps/StepWallet";
import CompanySetup from "@/components/features/company/CompanySetup";
import StepEmployees from "./steps/StepEmployees";
import StepFunding from "./steps/StepFunding";
import { Check } from "lucide-react";

const STEPS = [
  { id: 1, name: "Wallet Connect" },
  { id: 2, name: "Company Profile" },
  { id: 3, name: "Add Employees" },
  { id: 4, name: "Funding Setup" },
];

export default function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    } else {
      // Completed flow, redirect to dashboard
      window.location.href = "/";
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!mounted) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Stepper */}
      <nav aria-label="Progress" className="mb-8">
        <ol className="flex items-center justify-between w-full">
          {STEPS.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            
            return (
              <li key={step.name} className="relative flex-1 flex flex-col items-center">
                {/* Connecting line */}
                {index !== STEPS.length - 1 && (
                  <div
                    className={`absolute top-4 left-1/2 w-full h-0.5 -translate-y-1/2 ${
                      isCompleted ? "bg-indigo-600" : "bg-gray-200"
                    }`}
                    aria-hidden="true"
                  />
                )}
                
                {/* Step Circle */}
                <div className="relative z-10 flex items-center justify-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      isCompleted
                        ? "bg-indigo-600 text-white"
                        : isCurrent
                        ? "bg-white border-2 border-indigo-600 text-indigo-600"
                        : "bg-white border-2 border-gray-300 text-gray-400"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </div>
                </div>
                
                {/* Step Label */}
                <div className="mt-3 hidden sm:block">
                  <span
                    className={`text-xs font-medium transition-colors ${
                      isCompleted || isCurrent ? "text-indigo-600" : "text-gray-500"
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        {currentStep === 1 && <StepWallet onNext={handleNext} />}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Company Profile</h2>
              <p className="text-sm text-gray-500 mt-2">
                Configure your company details to set up your account.
              </p>
            </div>
            <CompanySetup onNext={handleNext} />
            <div className="pt-4 border-t border-gray-100 flex justify-start">
               <button
                  onClick={handleBack}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Back
                </button>
            </div>
          </div>
        )}
        {currentStep === 3 && <StepEmployees onNext={handleNext} onBack={handleBack} />}
        {currentStep === 4 && <StepFunding onNext={handleNext} onBack={handleBack} />}
      </div>
    </div>
  );
}
