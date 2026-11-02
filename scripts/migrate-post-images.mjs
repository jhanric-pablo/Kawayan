// One-time move of post images out of the database and into Supabase Storage.
//
// Older posts keep their image as a base64 data URL in generated_posts.image_url (1–2 MB each),
// which made every calendar load slow. This uploads each one to the public 'post-images' bucket
// and replaces image_url with the file's public URL.
//
//   node --env-file=.env scripts/migrate-post-images.mjs           # report only, changes nothing
//   node --env-file=.env scripts/migrate-post-images.mjs --apply   # move them
//
// With --apply, each original is first appended to scripts/backups/post-images-<date>.jsonl
// ({ id, image_url } per line), so any post can be restored. Posts are handled one at a time.
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env).');
  process.exit(1);
}
const supabase = createClient(url, key);
const BUCKET = 'post-images';

// Only ids here; the heavy image_url column is read one post at a time below.
const { data: rows, error } = await supabase.from('generated_posts').select('id, user_id').like('image_url', 'data:%');
if (error) throw error;
console.log(`${rows.length} post${rows.length === 1 ? '' : 's'} still store their image in the database.`);
if (!rows.length) process.exit(0);

if (!apply) {
  console.log('Report only. Run again with --apply to move them to Storage.');
  process.exit(0);
}

const { error: bucketError } = await supabase.storage.createBucket(BUCKET, { public: true });
if (bucketError && !/already exists/i.test(bucketError.message)) throw bucketError;

fs.mkdirSync('scripts/backups', { recursive: true });
const backupFile = `scripts/backups/post-images-${new Date().toISOString().slice(0, 10)}.jsonl`;
let moved = 0;
let bytes = 0;

for (const { id, user_id } of rows) {
  const { data: post, error: readError } = await supabase.from('generated_posts').select('image_url').eq('id', id).single();
  if (readError) { console.warn(`skip ${id}: ${readError.message}`); continue; }
  const match = /^data:([^;]+);base64,(.+)$/.exec(post.image_url || '');
  if (!match) { console.warn(`skip ${id}: not a base64 image`); continue; }

  const [, contentType, b64] = match;
  const buffer = Buffer.from(b64, 'base64');
  const ext = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }[contentType] || 'img';
  const path = `${user_id}/${id}.${ext}`;

  fs.appendFileSync(backupFile, JSON.stringify({ id, image_url: post.image_url }) + '\n');
  const { error: upError } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true, cacheControl: '31536000' });
  if (upError) { console.warn(`skip ${id}: upload failed, ${upError.message}`); continue; }
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const { error: updateError } = await supabase.from('generated_posts').update({ image_url: publicUrl }).eq('id', id);
  if (updateError) { console.warn(`skip ${id}: update failed, ${updateError.message}`); continue; }
  moved++;
  bytes += post.image_url.length;
  console.log(`moved ${moved}/${rows.length}`);
}

console.log(`Done: ${moved} image${moved === 1 ? '' : 's'} moved, about ${(bytes / 1048576).toFixed(1)} MB taken out of the posts table.`);
console.log(`Originals saved in ${backupFile}. Keep it until you've checked the calendar.`);
