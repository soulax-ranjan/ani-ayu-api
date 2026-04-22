import bcrypt from 'bcrypt'
import { supabaseAdmin, TABLES } from '../src/lib/supabase.js'
import dotenv from 'dotenv'

dotenv.config()

async function createAdmin(email, password, firstName = 'Admin', lastName = 'User') {
  console.log(`🚀 Creating admin user: ${email}...`)

  try {
    // 1. Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from(TABLES.USERS)
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      console.log(`⚠️ User with email ${email} already exists. Updating to admin role...`)
      
      const { error: updateError } = await supabaseAdmin
        .from(TABLES.USERS)
        .update({ role: 'admin' })
        .eq('email', email)

      if (updateError) {
        console.error('❌ Failed to update user role:', updateError)
        return
      }
      
      console.log('✅ User updated to admin role successfully!')
      return
    }

    // 2. Hash the password
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // 3. Insert the admin user
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from(TABLES.USERS)
      .insert({
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role: 'admin',
        phone: '0000000000'
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to create admin user:', insertError)
      return
    }

    console.log('✅ Admin user created successfully!')
    console.log('User details:', {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role
    })

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error)
  }
}

// Get credentials from command line or use defaults
const email = process.argv[2] || 'admin@aniayu.com'
const password = process.argv[3] || 'Admin@123'

if (!process.argv[2] || !process.argv[3]) {
  console.log('ℹ️ Usage: node scripts/create-admin.js <email> <password>')
  console.log(`ℹ️ No arguments provided, using defaults: ${email} / ${password}`)
}

createAdmin(email, password)
