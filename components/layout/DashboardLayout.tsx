import Header from "./Header";
import Sidebar from "./Sidebar";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main
          id="main-content"
          className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
