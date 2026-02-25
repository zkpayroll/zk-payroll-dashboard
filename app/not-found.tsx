import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="bg-blue-50 p-6 rounded-full mb-8">
        <FileQuestion className="h-16 w-16 text-blue-500" />
      </div>
      <h1 className="text-6xl font-extrabold text-gray-900 mb-4">404</h1>
      <h2 className="text-3xl font-bold text-gray-800 mb-4">Page Not Found</h2>
      <p className="text-lg text-gray-600 mb-10 max-w-lg">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved, 
        deleted, or the URL might be incorrect.
      </p>
      <Link href="/" passHref>
        <Button size="lg" className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
