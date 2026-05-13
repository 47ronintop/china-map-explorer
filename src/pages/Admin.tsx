import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Upload, Trash2, Plus, LogOut, Save } from 'lucide-react';
import { eraFromYear, ERAS } from '@/data/scenes';

const AUTH_KEY = 'hx_admin_auth';

interface SceneRow {
  id: string;
  title: string;
  description: string;
  image_url: string;
  panorama_url: string | null;
  lng: number;
  lat: number;
  location_name: string;
  year: number;
  era: string;
  source: string;
  sort_order: number;
}

const EMPTY: SceneRow = {
  id: '', title: '', description: '', image_url: '', panorama_url: null,
  lng: 116, lat: 39, location_name: '', year: 1000, era: 'ancient',
  source: '', sort_order: 0,
};

export default function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1');
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [scenes, setScenes] = useState<SceneRow[]>([]);
  const [editing, setEditing] = useState<SceneRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = '后台管理 · 华舆寻踪'; }, []);
  useEffect(() => { if (authed) refresh(); }, [authed]);

  async function refresh() {
    const { data, error } = await supabase.from('scenes').select('*').order('sort_order');
    if (error) toast.error(error.message);
    else setScenes((data ?? []) as SceneRow[]);
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('admin_credentials')
      .select('id')
      .eq('username', u)
      .eq('password', p)
      .maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (data) {
      sessionStorage.setItem(AUTH_KEY, '1');
      setAuthed(true);
    } else {
      toast.error('账号或密码错误');
    }
  }
  function logout() { sessionStorage.removeItem(AUTH_KEY); setAuthed(false); }

  async function upload(file: File, folder: 'scenes' | 'panoramas') {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('scene-assets').upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); return null; }
    const { data } = supabase.storage.from('scene-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  async function save() {
    if (!editing) return;
    if (!editing.id || !editing.title || !editing.image_url) {
      toast.error('ID、标题、场景图必填'); return;
    }
    setLoading(true);
    const { error } = await supabase.from('scenes').upsert({ ...editing, era: eraFromYear(editing.year) });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success('已保存'); setEditing(null); refresh(); }
  }

  async function remove(id: string) {
    if (!confirm(`删除 ${id}?`)) return;
    const { error } = await supabase.from('scenes').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('已删除'); refresh(); }
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <form onSubmit={login} className="paper-card p-8 w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold ink-text text-center">后台登录</h1>
          <div className="space-y-2">
            <Label>账号</Label>
            <Input value={u} onChange={e => setU(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label>密码</Label>
            <Input type="password" value={p} onChange={e => setP(e.target.value)} />
          </div>
          <Button type="submit" className="w-full seal-btn">登录</Button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold ink-text">场景管理</h1>
        <div className="flex gap-2">
          <Button onClick={() => setEditing({ ...EMPTY, sort_order: scenes.length + 1 })}>
            <Plus className="w-4 h-4 mr-1" />新增
          </Button>
          <Button variant="outline" onClick={logout}>
            <LogOut className="w-4 h-4 mr-1" />退出
          </Button>
        </div>
      </header>

      <div className="paper-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-3">排序</th>
              <th className="p-3">ID</th>
              <th className="p-3">标题</th>
              <th className="p-3">地点</th>
              <th className="p-3">年份</th>
              <th className="p-3">全景</th>
              <th className="p-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map(s => (
              <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3">{s.sort_order}</td>
                <td className="p-3 font-mono text-xs">{s.id}</td>
                <td className="p-3">{s.title}</td>
                <td className="p-3">{s.location_name}</td>
                <td className="p-3">{s.year}</td>
                <td className="p-3">{s.panorama_url ? '✓' : '—'}</td>
                <td className="p-3 text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(s)}>编辑</Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(s.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </td>
              </tr>
            ))}
            {scenes.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">暂无场景</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center p-4">
          <div className="paper-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="text-xl font-bold ink-text">
              {scenes.find(s => s.id === editing.id) ? '编辑场景' : '新增场景'}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ID (英文唯一)"><Input value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })} disabled={!!scenes.find(s => s.id === editing.id)} /></Field>
              <Field label="排序"><Input type="number" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: +e.target.value })} /></Field>
              <Field label="标题" full><Input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="描述" full><Textarea rows={2} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></Field>
              <Field label="地点名"><Input value={editing.location_name} onChange={e => setEditing({ ...editing, location_name: e.target.value })} /></Field>
              <Field label="年份 (BCE 用负数)"><Input type="number" value={editing.year} onChange={e => { const y = +e.target.value; setEditing({ ...editing, year: y, era: eraFromYear(y) }); }} /></Field>
              <Field label="经度 (lng)"><Input type="number" step="0.001" value={editing.lng} onChange={e => setEditing({ ...editing, lng: +e.target.value })} /></Field>
              <Field label="纬度 (lat)"><Input type="number" step="0.001" value={editing.lat} onChange={e => setEditing({ ...editing, lat: +e.target.value })} /></Field>
              <Field label="时代 (根据年份自动判定)">
                <Input value={`${ERAS[eraFromYear(editing.year)].label} (${ERAS[eraFromYear(editing.year)].range})`} disabled />
              </Field>
              <Field label="出处"><Input value={editing.source} onChange={e => setEditing({ ...editing, source: e.target.value })} /></Field>

              <Field label="场景图 URL" full>
                <div className="flex gap-2">
                  <Input value={editing.image_url} onChange={e => setEditing({ ...editing, image_url: e.target.value })} />
                  <label className="inline-flex items-center px-3 border border-border rounded-md cursor-pointer hover:bg-muted">
                    <Upload className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      toast.info('上传中...');
                      const url = await upload(f, 'scenes');
                      if (url) { setEditing({ ...editing, image_url: url }); toast.success('已上传'); }
                    }} />
                  </label>
                </div>
                {editing.image_url && <img src={editing.image_url} alt="" className="mt-2 h-24 rounded object-cover" />}
              </Field>

              <Field label="360° 全景图 URL (可选)" full>
                <div className="flex gap-2">
                  <Input value={editing.panorama_url ?? ''} onChange={e => setEditing({ ...editing, panorama_url: e.target.value || null })} />
                  <label className="inline-flex items-center px-3 border border-border rounded-md cursor-pointer hover:bg-muted">
                    <Upload className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      toast.info('上传中...');
                      const url = await upload(f, 'panoramas');
                      if (url) { setEditing({ ...editing, panorama_url: url }); toast.success('已上传'); }
                    }} />
                  </label>
                </div>
                {editing.panorama_url && <img src={editing.panorama_url} alt="" className="mt-2 h-20 rounded object-cover w-full" />}
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={save} disabled={loading} className="seal-btn">
                <Save className="w-4 h-4 mr-1" />保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? 'col-span-2' : ''}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
