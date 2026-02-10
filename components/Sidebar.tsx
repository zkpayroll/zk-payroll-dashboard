import { Home, Users, Settings, History } from "lucide-react";

export default function Sidebar() {
    return (
        <div className="hidden md:block w-64 bg-white shadow-md">
            <div className="p-6">
                <h1 className="text-2xl font-bold text-gray-800">ZK Payroll</h1>
            </div>
            <nav className="mt-6">
                <a className="flex items-center px-6 py-3 text-gray-700 bg-gray-100 border-r-4 border-blue-500" href="#">
                    <Home className="w-5 h-5 mr-3" />
                    Dashboard
                </a>
                <a className="flex items-center px-6 py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900" href="#">
                    <Users className="w-5 h-5 mr-3" />
                    Employees
                </a>
                <a className="flex items-center px-6 py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900" href="#">
                    <History className="w-5 h-5 mr-3" />
                    History
                </a>
                <a className="flex items-center px-6 py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900" href="#">
                    <Settings className="w-5 h-5 mr-3" />
                    Settings
                </a>
            </nav>
        </div>
    );
}
