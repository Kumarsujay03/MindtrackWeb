import { useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Question = {
  question_id?: number;
  title?: string;
  url?: string;
  source?: string;
  difficulty?: string;
  is_premium?: any;
  acceptance_rate?: number;
  frequency?: number;
  categories?: string;
  companies?: string;
};

export default function Questions() {
  const [rows, setRows] = useState<Question[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [limit, setLimit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);
  const [search, setSearch] = useState<string>("");
  const [categoriesSelected, setCategoriesSelected] = useState<string[]>([]);
  const [sheetsSelected, setSheetsSelected] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string[]>([]);
  const [categories, setCategories] = useState<Array<{ category_id: number; name: string }>>([]);
  const [sheets, setSheets] = useState<Array<{ sheet_id: number; name: string; source?: string }>>([]);
  const [companiesSelected, setCompaniesSelected] = useState<string[]>([]);
  const [companies, setCompanies] = useState<Array<{ company_id: number; name: string }>>([]);

  const difficultyOptions = useMemo(() => ["Easy", "Medium", "Hard"], []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (search.trim()) params.set("q", search.trim());
  categoriesSelected.forEach((c) => params.append("category", c));
  sheetsSelected.forEach((s) => params.append("sheet", s));
  companiesSelected.forEach((c) => params.append("company", c));
  difficulty.forEach((d) => params.append("difficulty", d));
  const res = await fetch(`/api/questions?${params.toString()}`);
        const raw = await res.text();
        if (!res.ok) throw new Error(raw || `API error ${res.status}`);
        let data: any = {};
        try { data = JSON.parse(raw); } catch { throw new Error("Invalid JSON from /api/questions"); }
        if (!data?.ok) throw new Error(data?.error || "Unexpected response");
        if (!cancelled) {
          setColumns(Array.isArray(data.columns) ? data.columns : []);
          setRows(Array.isArray(data.rows) ? data.rows : []);
          setTotal(typeof data.total === "number" ? data.total : 0);
          setLimit(typeof data.limit === "number" ? data.limit : 50);
          setOffset(typeof data.offset === "number" ? data.offset : 0);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load questions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [offset, limit, search, categoriesSelected, sheetsSelected, companiesSelected, difficulty]);

  // Load filter options
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catRes, sheetRes, compRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/sheets"),
          fetch("/api/companies"),
        ]);
        const [catRaw, sheetRaw, compRaw] = await Promise.all([catRes.text(), sheetRes.text(), compRes.text()]);
        let cat: any = {}; let sh: any = {}; let co: any = {};
        try { cat = JSON.parse(catRaw); } catch {}
        try { sh = JSON.parse(sheetRaw); } catch {}
        try { co = JSON.parse(compRaw); } catch {}
        if (!cancelled) {
          if (cat?.ok && Array.isArray(cat.rows)) setCategories(cat.rows);
          if (sh?.ok && Array.isArray(sh.rows)) setSheets(sh.rows);
          if (co?.ok && Array.isArray(co.rows)) setCompanies(co.rows);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Build display columns, ensuring URL appears as the last column
  const baseCols = (columns.length ? columns : [
    "question_id","title","url","source","difficulty","is_premium","acceptance_rate","frequency","categories","companies"
  ]).filter(Boolean);
  const displayCols = (() => {
    const arr = [...baseCols];
    const idxUrl = arr.indexOf("url");
    if (idxUrl !== -1) {
      arr.splice(idxUrl, 1);
      arr.push("url");
    }
    return arr;
  })();

  const page = Math.floor(offset / Math.max(1, limit)) + (rows.length ? 1 : 0);
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const canPrev = offset > 0;
  const canNext = offset + rows.length < total;

  return (
    <div className="w-full px-2 sm:px-4">
      <div className="glass-panel p-3 sm:p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Questions</h2>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            value={search}
            onChange={(e) => { setOffset(0); setSearch(e.target.value); }}
            placeholder="Search title"
            className="px-3 py-2 rounded-md bg-white/5 border border-white/10 min-w-[220px]"
          />
          {/* Difficulty Dropdown (multi-select) */}
          <DropdownMenu>
            <DropdownMenuTrigger className="px-3 py-2 rounded-md bg-white/5 border border-white/10 text-left">
              <div className="flex items-center gap-2">
                <span>Difficulty</span>
                {difficulty.length > 0 && (
                  <span className="text-xs text-white/70">({difficulty.length} selected)</span>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[200px]">
              <DropdownMenuLabel>Select difficulty</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {difficultyOptions.map((d) => (
                <DropdownMenuCheckboxItem
                  key={d}
                  checked={difficulty.includes(d)}
                  onCheckedChange={(checked) => {
                    setOffset(0);
                    setDifficulty((prev) => checked ? [...prev, d] : prev.filter((x) => x !== d));
                  }}
                >
                  {d}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Categories Dropdown (multi-select) */}
          <DropdownMenu>
            <DropdownMenuTrigger className="px-3 py-2 rounded-md bg-white/5 border border-white/10 text-left">
              <div className="flex items-center gap-2">
                <span>Categories</span>
                {categoriesSelected.length > 0 && (
                  <span className="text-xs text-white/70">({categoriesSelected.length} selected)</span>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[240px] max-h-96 scrollbox">
              <DropdownMenuLabel>Select categories</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.category_id}
                  checked={categoriesSelected.includes(c.name)}
                  onCheckedChange={(checked) => {
                    setOffset(0);
                    setCategoriesSelected((prev) => checked ? [...prev, c.name] : prev.filter((x) => x !== c.name));
                  }}
                >
                  {c.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sheets Dropdown (multi-select) */}
          <DropdownMenu>
            <DropdownMenuTrigger className="px-3 py-2 rounded-md bg-white/5 border border-white/10 text-left">
              <div className="flex items-center gap-2">
                <span>Sheets</span>
                {sheetsSelected.length > 0 && (
                  <span className="text-xs text-white/70">({sheetsSelected.length} selected)</span>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[240px] max-h-96 scrollbox">
              <DropdownMenuLabel>Select sheets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sheets.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s.sheet_id}
                  checked={sheetsSelected.includes(s.name)}
                  onCheckedChange={(checked) => {
                    setOffset(0);
                    setSheetsSelected((prev) => checked ? [...prev, s.name] : prev.filter((x) => x !== s.name));
                  }}
                >
                  {s.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Companies Dropdown (multi-select) */}
          <DropdownMenu>
            <DropdownMenuTrigger className="px-3 py-2 rounded-md bg-white/5 border border-white/10 text-left">
              <div className="flex items-center gap-2">
                <span>Companies</span>
                {companiesSelected.length > 0 && (
                  <span className="text-xs text-white/70">({companiesSelected.length} selected)</span>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[240px] max-h-96 scrollbox">
              <DropdownMenuLabel>Select companies</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {companies.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.company_id}
                  checked={companiesSelected.includes(c.name)}
                  onCheckedChange={(checked) => {
                    setOffset(0);
                    setCompaniesSelected((prev) => checked ? [...prev, c.name] : prev.filter((x) => x !== c.name));
                  }}
                >
                  {c.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => { setSearch(""); setCategoriesSelected([]); setSheetsSelected([]); setCompaniesSelected([]); setDifficulty([]); setOffset(0); }}
            className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/15"
          >
            Reset
          </button>
        </div>
        {error && <div className="text-red-300 mb-2">{error}</div>}
        {loading ? (
          <div className="text-white/70">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-white/70">No questions found.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="text-left border-b border-white/10">
                  {displayCols.map((c) => (
                    <th key={c} className="py-2 px-2 sm:px-3 capitalize whitespace-nowrap">{c.replace(/_/g, " ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="border-b border-white/5">
                    {displayCols.map((k) => {
                      const val = (r as any)[k];
                      if (k === "title") {
                        return (
                          <td key={k} className="py-2 px-2 sm:px-3 align-top max-w-[420px]">
                            <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{String(val ?? "")}</div>
                          </td>
                        );
                      }
                      if (k === "url" && r.url) {
                        return (
                          <td key={k} className="py-2 px-2 sm:px-3 align-top">
                            <a href={r.url} target="_blank" rel="noreferrer" title={r.url} className="text-blue-400 hover:underline">Link</a>
                          </td>
                        );
                      }
                      if (k === "categories") {
                        const list = typeof val === "string" && val.trim() ? val.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
                        const first = list[0];
                        const rest = list.slice(1);
                        return (
                          <td key={k} className="py-2 px-2 sm:px-3 align-top">
                            {list.length === 0 ? (
                              <span className="text-white/60">-</span>
                            ) : (
                              <div className="relative group inline-flex items-center gap-1">
                                <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-xs max-w-40 truncate">{first}</span>
                                {rest.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-xs whitespace-nowrap cursor-default">+{rest.length}</span>
                                )}
                                {rest.length > 0 && (
                                  <div className="absolute right-0 top-full z-20 hidden group-hover:block mt-1 p-2 bg-black/85 backdrop-blur rounded border border-white/15 w-64 max-h-56 overflow-auto shadow-lg scrollbox">
                                    <div className="flex flex-wrap gap-1 pr-1">
                                      {rest.map((name: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-xs whitespace-nowrap">{name}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      }
                      if (k === "companies") {
                        const list = typeof val === "string" && val.trim() ? val.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
                        const first = list[0];
                        const rest = list.slice(1);
                        return (
                          <td key={k} className="py-2 px-2 sm:px-3 align-top">
                            {list.length === 0 ? (
                              <span className="text-white/70">NA</span>
                            ) : (
                              <div className="relative group inline-flex items-center gap-1">
                                <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-xs max-w-40 truncate">{first}</span>
                                {rest.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-xs whitespace-nowrap cursor-default">+{rest.length}</span>
                                )}
                                {rest.length > 0 && (
                                  <div className="absolute right-0 top-full z-20 hidden group-hover:block mt-1 p-2 bg-black/85 backdrop-blur rounded border border-white/15 w-64 max-h-56 overflow-auto shadow-lg scrollbox">
                                    <div className="flex flex-wrap gap-1 pr-1">
                                      {rest.map((name: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-xs whitespace-nowrap">{name}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      }
                      return (
                        <td key={k} className="py-2 px-2 sm:px-3 align-top">{String(val ?? "")}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between mt-3">
              <div className="text-white/70 text-xs">
                Showing {rows.length ? offset + 1 : 0}–{offset + rows.length} of {total}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-md bg-white/10 enabled:hover:bg-white/15 disabled:opacity-50"
                  disabled={!canPrev}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  Prev
                </button>
                <span className="text-white/70 text-xs">Page {page} / {pageCount}</span>
                <button
                  className="px-3 py-1.5 rounded-md bg-white/10 enabled:hover:bg-white/15 disabled:opacity-50"
                  disabled={!canNext}
                  onClick={() => setOffset(offset + limit)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
