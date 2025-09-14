import { useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/Auth/AuthContext";

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
  is_starred?: number;
  is_solved?: number;
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
  const { user } = useAuth();
  const [startedOnly, setStartedOnly] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");

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
  if (user?.uid) params.set("user_id", user.uid);
  if (startedOnly && user?.uid) params.set("started", "1");
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
  }, [offset, limit, search, categoriesSelected, sheetsSelected, companiesSelected, difficulty, startedOnly, user?.uid]);

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

  const baseCols = (columns.length ? columns : [
    "question_id","title","url","source","difficulty","is_premium","acceptance_rate","frequency","categories","companies"
  ]).filter(Boolean);
  const displayCols = (() => {
    const arr = [...baseCols];
    const idxStar = arr.indexOf("is_starred");
    const idxId = arr.indexOf("question_id");
    if (idxStar !== -1 && idxId !== -1) {
      arr.splice(idxStar, 1);
      const newIdxId = arr.indexOf("question_id");
      arr.splice(newIdxId, 0, "is_starred");
    }
    const idxUrl = arr.indexOf("url");
    const hadUrl = idxUrl !== -1;
    if (hadUrl) arr.splice(idxUrl, 1);
    const idxSolved = arr.indexOf("is_solved");
    if (idxSolved !== -1) {
      arr.splice(idxSolved, 1);
      arr.push("is_solved");
    }
    if (hadUrl) {
      const sIdx = arr.indexOf("is_solved");
      if (sIdx !== -1) arr.splice(sIdx, 0, "url");
      else arr.push("url");
    }
    return arr;
  })();

  const page = Math.floor(offset / Math.max(1, limit)) + (rows.length ? 1 : 0);
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const canPrev = offset > 0;
  const canNext = offset + rows.length < total;

  const colVisibility: Record<string, string> = useMemo(() => ({
    is_starred: "",
    title: "",
    difficulty: "",
    is_solved: "",

    question_id: "hidden sm:table-cell",

    url: "hidden md:table-cell",
    source: "hidden md:table-cell",
    is_premium: "hidden lg:table-cell",

    categories: "hidden lg:table-cell",
    companies: "hidden lg:table-cell",

    acceptance_rate: "hidden xl:table-cell",
    frequency: "hidden xl:table-cell",
  }), []);

  return (
    <div className="w-full px-2 sm:px-4 mt-6">
      <div className="glass-panel p-3 sm:p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Questions</h2>
        
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            value={search}
            onChange={(e) => { setOffset(0); setSearch(e.target.value); }}
            placeholder="Search title"
            className="px-3 py-2 rounded-md bg-white/5 border border-white/10 min-w-[220px]"
          />
          <button
            type="button"
            disabled={!user}
            onClick={() => { setOffset(0); setStartedOnly((v) => !v); }}
            className={`inline-flex items-center justify-center h-10 w-10 rounded-md border transition-colors ${startedOnly ? "bg-amber-500/15 border-amber-400/30 text-amber-200" : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"} disabled:opacity-50`}
            title={!user ? "Sign in to use Started filter" : "Toggle Started filter"}
            aria-label="Toggle Started filter"
          >
            <span className={`${startedOnly ? "" : "opacity-90"} text-base leading-none`}>{startedOnly ? "★" : "☆"}</span>
          </button>
          
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
              <div className="px-2 pb-2">
                <input
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Search categories"
                  className="w-full px-2 py-1 rounded-md bg-white/5 border border-white/10"
                />
              </div>
              {categories
                .filter((c) =>
                  categoryFilter.trim()
                    ? c.name.toLowerCase().includes(categoryFilter.trim().toLowerCase())
                    : true
                )
                .map((c) => (
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
              {categories.filter((c) =>
                categoryFilter.trim()
                  ? c.name.toLowerCase().includes(categoryFilter.trim().toLowerCase())
                  : true
              ).length === 0 && (
                <div className="px-3 py-2 text-sm text-white/60">No matches</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          
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
              <div className="px-2 pb-2">
                <input
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Search companies"
                  className="w-full px-2 py-1 rounded-md bg-white/5 border border-white/10"
                />
              </div>
              {companies
                .filter((c) =>
                  companyFilter.trim()
                    ? c.name.toLowerCase().includes(companyFilter.trim().toLowerCase())
                    : true
                )
                .map((c) => (
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
              {companies.filter((c) =>
                companyFilter.trim()
                  ? c.name.toLowerCase().includes(companyFilter.trim().toLowerCase())
                  : true
              ).length === 0 && (
                <div className="px-3 py-2 text-sm text-white/60">No matches</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => { setSearch(""); setCategoriesSelected([]); setSheetsSelected([]); setCompaniesSelected([]); setDifficulty([]); setStartedOnly(false); setOffset(0); }}
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
          <div>
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="text-left border-b border-white/10">
                  {displayCols.map((c) => (
                    <th key={c} className={`py-2 px-2 sm:px-3 capitalize whitespace-nowrap ${colVisibility[c] || ""}`}>
                      {c === "question_id"
                        ? "ID"
                        : c === "is_starred"
                        ? "Starred"
                        : c === "is_premium"
                        ? "Premium"
                        : c === "is_solved"
                        ? "Solved"
                        : c.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="border-b border-white/5">
                    {displayCols.map((k) => {
                      const vis = colVisibility[k] || "";
                      const val = (r as any)[k];
                      if (k === "title") {
                        return (
                          <td key={k} className={`py-2 px-2 sm:px-3 align-top max-w-[220px] sm:max-w-[420px] ${vis}`}>
                            <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{String(val ?? "")}</div>
                          </td>
                        );
                      }
                      if (k === "is_starred") {
                        const active = Number(val || 0) === 1;
                        const canToggle = Boolean(user);
                        return (
                          <td key={k} className={`py-2 px-2 sm:px-3 align-middle whitespace-nowrap ${vis}`}>
                            <button
                              disabled={!canToggle}
                              onClick={async () => {
                                if (!user) return;
                                const optimistic = !active ? 1 : 0;
                                setRows((prev) => prev.map((row, i) => i === idx ? { ...row, is_starred: optimistic } : row));
                                try {
                                  const action = !active ? "star" : "unstar";
                                  const res = await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.uid, question_id: r.question_id, action }) });
                                  if (!res.ok) throw new Error(await res.text());
                                } catch {
                                  
                                  setRows((prev) => prev.map((row, i) => i === idx ? { ...row, is_starred: active ? 1 : 0 } : row));
                                }
                              }}
                              className={`inline-flex items-center justify-center p-0 bg-transparent border-0 cursor-pointer transition-colors disabled:opacity-50 ${active ? "text-amber-200" : "text-white/80 hover:text-white"}`}
                              title={active ? "Started" : "Mark as started"}
                              aria-label={active ? "Started" : "Mark as started"}
                              style={{ lineHeight: 1 }}
                            >
                              <span className="text-base leading-none align-middle">{active ? "★" : "☆"}</span>
                            </button>
                          </td>
                        );
                      }
                      if (k === "is_solved") {
                        const active = Number(val || 0) === 1;
                        const canToggle = Boolean(user);
                        return (
                          <td key={k} className={`py-2 px-2 sm:px-3 align-top ${vis}`}>
                            <button
                              type="button"
                              disabled={!canToggle}
                              onClick={async () => {
                                if (!user) return;
                                const optimistic = !active ? 1 : 0;
                                setRows((prev) => prev.map((row, i) => i === idx ? { ...row, is_solved: optimistic } : row));
                                try {
                                  const action = !active ? "solve" : "unsolve";
                                  const res = await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.uid, question_id: r.question_id, action }) });
                                  if (!res.ok) throw new Error(await res.text());
                                } catch {
                                  
                                  setRows((prev) => prev.map((row, i) => i === idx ? { ...row, is_solved: active ? 1 : 0 } : row));
                                }
                              }}
                              className={`px-2 py-1 rounded-full text-xs border transition-colors ${active ? "bg-green-500/20 border-green-400/40 text-green-200" : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"}`}
                              title={active ? "Solved" : "Mark as solved"}
                            >
                              <span className="mr-1">{active ? "✓" : "○"}</span>
                              <span>{active ? "Done" : "Mark"}</span>
                            </button>
                          </td>
                        );
                      }
                      if (k === "url" && r.url) {
                        return (
                          <td key={k} className={`py-2 px-2 sm:px-3 align-top ${vis}`}>
                            <a href={r.url} target="_blank" rel="noreferrer" title={r.url} className="text-blue-400 hover:underline">Link</a>
                          </td>
                        );
                      }
                      if (k === "categories") {
                        const list = typeof val === "string" && val.trim() ? val.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
                        const first = list[0];
                        const rest = list.slice(1);
                        return (
                          <td key={k} className={`py-2 px-2 sm:px-3 align-top ${vis}`}>
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
                          <td key={k} className={`py-2 px-2 sm:px-3 align-top ${vis}`}>
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
                      
                      if (k === "is_premium") {
                        const v = val;
                        let text = "";
                        if (v === 1 || v === "1" || v === true) text = "Y";
                        else if (v === 0 || v === "0" || v === false) text = "N";
                        else text = "";
                        return (
                          <td key={k} className={`py-2 px-2 sm:px-3 align-top ${vis}`}>{text}</td>
                        );
                      }
                      
                      return (
                        <td key={k} className={`py-2 px-2 sm:px-3 align-top ${vis}`}>{val == null ? "" : String(val)}</td>
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
