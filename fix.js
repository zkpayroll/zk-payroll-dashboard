const fs = require('fs');

const path = "components/features/transactions/TransactionHistory.tsx";
const content = fs.readFileSync(path, 'utf8');

const newTableStart = content.indexOf('<table className="w-full text-left">');
const activeFilterStart = content.indexOf('{/* ── Active filter bar with save button ──────────────────── */}');

let newTableCode = content.slice(newTableStart, activeFilterStart).trim();

// Append closing tags for the new table
newTableCode += `
                  </tr>
                ))
              )}
            </tbody>
          </table>
`;

const isLoadingStart = content.indexOf('{isLoading ? (');
const oldTableStart = content.indexOf('<table className="w-full text-left">', isLoadingStart);
const showingTextStart = content.indexOf('<div className="px-4 sm:px-6 py-3 border-t text-xs text-gray-500">', oldTableStart);

const beforeNewTable = content.slice(0, newTableStart).trim();
const activeFilterCode = content.slice(activeFilterStart, isLoadingStart).trim();
const skeletonCode = content.slice(isLoadingStart, oldTableStart).trim();
const afterOldTable = content.slice(showingTextStart).trim();

const newContent = `${beforeNewTable}
        ${activeFilterCode}

        ${skeletonCode}
${newTableCode}
            ${afterOldTable}
`;

fs.writeFileSync(path, newContent, 'utf8');
