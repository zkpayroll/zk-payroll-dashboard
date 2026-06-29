import re

with open("components/features/transactions/TransactionHistory.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# The file currently has a broken table from line 469 (table opening) to line 579 (</td> of the last column)
# Then it has the active filter bar.
# Then it has isLoading ? (skeleton) : (old table).

# We will extract the new table header and body.
new_table_start = content.find('<table className="w-full text-left">')
active_filter_start = content.find('{/* ── Active filter bar with save button ──────────────────── */}')

new_table_code = content[new_table_start:active_filter_start].strip()

# Now we need to close the new table code properly.
# Currently it ends with:
#                     </button>
#                   </td>
new_table_code += """
                  </tr>
                ))
              )}
            </tbody>
          </table>
"""

# Now we find the isLoading block.
is_loading_start = content.find('{isLoading ? (')
old_table_start = content.find('<table className="w-full text-left">', is_loading_start)
showing_text_start = content.find('<div className="px-4 sm:px-6 py-3 border-t text-xs text-gray-500">', old_table_start)

# We want everything before the first broken table.
before_new_table = content[:new_table_start].strip()

# We want the active filter bar.
active_filter_end = is_loading_start
active_filter_code = content[active_filter_start:active_filter_end].strip()

# We want the skeleton loader up to the old table start
skeleton_code = content[is_loading_start:old_table_start].strip()

# We want everything after the old table ends (which is the showing text)
after_old_table = content[showing_text_start:].strip()

# Assemble the new file content:
new_content = f"""{before_new_table}
        {active_filter_code}

        {skeleton_code}
{new_table_code}
            {after_old_table}
"""

with open("components/features/transactions/TransactionHistory.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)
