import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uvfdbvzydbogfkntfuix.supabase.co'
const supabaseAnonKey = 'sb_publishable_E-hr1YBueC-gkt_w2c_AAg_JOcDMAsl'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)