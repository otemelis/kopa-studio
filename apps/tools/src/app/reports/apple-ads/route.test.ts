import{it,expect,vi}from'vitest';
const owner=vi.hoisted(()=>vi.fn());vi.mock('@/lib/auth',()=>({requireOwner:owner}));
import{GET}from'./route';
it('requires the existing owner authorization before serving the direct page',async()=>{owner.mockRejectedValueOnce(Error('not owner'));await expect(GET()).rejects.toThrow('not owner');});
it('serves no source data or credentials, only a same-origin fetch and hash-restricted assets',async()=>{owner.mockResolvedValue({id:'owner'});const r=await GET(),s=await r.text();expect(r.headers.get('cache-control')).toBe('private, no-store');expect(r.headers.get('content-security-policy')).toContain("connect-src 'self'");expect(r.headers.get('content-security-policy')).not.toContain('unsafe-inline');expect(s).toContain("fetch('/api/apple-ads/reports/export'");expect(s).toContain('Previous successful report retained');expect(s).not.toContain('apple-ads-snapshot.json');expect(s).not.toContain('Bearer ');expect(s).not.toContain('service_role');});
