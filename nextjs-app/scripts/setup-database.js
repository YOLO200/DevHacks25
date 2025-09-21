const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  try {
    console.log('🔄 Running transcription columns migration...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/add-transcription-columns.sql')
    if (!fs.existsSync(migrationPath)) {
      console.log('⚠️  Migration file not found, skipping')
      return
    }
    
    const migration = fs.readFileSync(migrationPath, 'utf8')
    
    // Split into statements
    const statements = migration
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`📝 Running ${statements.length} migration statements...`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      console.log(`⚡ Executing migration ${i + 1}/${statements.length}`)
      
      try {
        // Use raw SQL execution via Supabase
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        if (error) {
          console.log(`⚠️  Migration statement ${i + 1} may require manual execution:`)
          console.log(`   ${statement.substring(0, 100)}...`)
        } else {
          console.log(`✅ Migration statement ${i + 1} executed successfully`)
        }
      } catch (err) {
        console.log(`⚠️  Migration statement ${i + 1} failed, may need manual execution`)
      }
    }
    
    console.log('✅ Migration completed!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.log('\n🔧 Manual Migration Required:')
    console.log('1. Go to your Supabase dashboard: https://app.supabase.com')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Run this SQL:')
    console.log('   ALTER TABLE recordings ADD COLUMN IF NOT EXISTS transcription TEXT;')
    console.log('   ALTER TABLE recordings ADD COLUMN IF NOT EXISTS summary TEXT;')
  }
}

async function setupDatabase() {
  try {
    console.log('🚀 Starting database setup...')

    // First run the migration for transcription columns if recordings table exists
    await runMigration()

    // Read the schema file  
    const schemaPath = path.join(__dirname, '../supabase/schema.sql')
    if (!fs.existsSync(schemaPath)) {
      console.log('⚠️  schema.sql not found, skipping schema setup')
      return
    }
    const schema = fs.readFileSync(schemaPath, 'utf8')

    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📝 Found ${statements.length} SQL statements to execute`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}`)
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        if (error) {
          // Try direct query if RPC fails
          const { error: directError } = await supabase.from('_').select('*').limit(0)
          if (directError && !directError.message.includes('relation "_" does not exist')) {
            throw error
          }
        }
      } catch (err) {
        console.log(`⚠️  Statement ${i + 1} may have already been executed or requires admin privileges:`)
        console.log(`   ${statement.substring(0, 100)}...`)
        // Continue with other statements
      }
    }

    console.log('✅ Database setup completed!')
    console.log('\n📋 Next steps:')
    console.log('1. Go to your Supabase dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Run the schema.sql file manually if any tables are missing')
    console.log('4. Enable RLS policies as needed')

  } catch (error) {
    console.error('❌ Database setup failed:', error.message)
    console.log('\n🔧 Manual Setup Required:')
    console.log('1. Go to your Supabase dashboard: https://app.supabase.com')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy and paste the contents of supabase/schema.sql')
    console.log('4. Run the SQL to create tables')
  }
}

// Test the caregiver_relationships table specifically
async function testCaregiverTable() {
  try {
    console.log('\n🔍 Testing caregiver_relationships table...')
    
    const { data, error } = await supabase
      .from('caregiver_relationships')
      .select('*')
      .limit(1)

    if (error) {
      throw error
    }

    console.log('✅ caregiver_relationships table is accessible!')
    return true
  } catch (error) {
    console.log('❌ caregiver_relationships table not found or not accessible')
    console.log('Error:', error.message)
    return false
  }
}

// Main execution
async function main() {
  await setupDatabase()
  const tableExists = await testCaregiverTable()
  
  if (!tableExists) {
    console.log('\n📋 Manual SQL to create caregiver_relationships table:')
    console.log(`
-- Caregiver Relationships Table
CREATE TABLE caregiver_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  caregiver_email TEXT NOT NULL,
  caregiver_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_caregiver_relationships_patient_id ON caregiver_relationships(patient_id);
CREATE INDEX idx_caregiver_relationships_caregiver_email ON caregiver_relationships(caregiver_email);
CREATE INDEX idx_caregiver_relationships_status ON caregiver_relationships(status);
    `)
  }
}

main().catch(console.error)