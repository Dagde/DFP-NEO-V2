#!/usr/bin/env python3
"""
Script to fix mobile API response format to match iOS app expectations
"""
import re

# Read the file
with open('DFP-NEO-V2-fresh/server.js', 'r') as f:
    content = f.read()

# Replace the login response section to match iOS expectations
old_login_response = '''      // Return success response
      res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: mappedRole
        }
      });'''

new_login_response = '''      // Return success response in iOS app's expected format
      res.json({
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: {
          id: String(user.id),
          userId: user.userId,
          displayName: user.firstName + " " + user.lastName,
          email: user.email,
          status: user.isActive ? "active" : "inactive",
          permissionsRole: {
            id: String(user.id),
            name: mappedRole
          },
          mustChangePassword: false
        },
        expiresIn: 3600 // 1 hour in seconds
      });'''

content = content.replace(old_login_response, new_login_response)

# Replace the refresh token response section
old_refresh_response = '''      res.json({
        success: true,
        accessToken,
        refreshToken: newRefreshToken
      });'''

new_refresh_response = '''      res.json({
        accessToken: accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600 // 1 hour in seconds
      });'''

content = content.replace(old_refresh_response, new_refresh_response)

# Write the modified content back
with open('DFP-NEO-V2-fresh/server.js', 'w') as f:
    f.write(content)

print("✅ Successfully fixed mobile API response format to match iOS app expectations")