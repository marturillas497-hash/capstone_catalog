/**
 * Sanitizes a raw search string before it gets interpolated into a
 * supabase-js .or()/.ilike() filter built via template literal.
 *
 * supabase-js has no parameterized form for .or(), the filter is a plain
 * string PostgREST parses itself. Comma separates OR conditions, period
 * separates column.operator.value, and parentheses group conditions, so any
 * of those characters typed into a search box can distort or break the
 * intended filter. Percent is the ilike wildcard, left untouched by the
 * filter parser but still worth stripping from user input so a typed "%"
 * can't be used to inject extra wildcarding beyond the intended %value%.
 *
 * See PRD Section 28, "PostgREST filter string interpolation."
 */
export function sanitizeFilterValue(value) {
  return value.replace(/[,.()%]/g, "");
}
