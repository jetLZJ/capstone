#### To-Do
- Produce code as define with the breakdown below
- Get the requirements / arguments from appendix section for each segment

#### Code Style Breakdown
- Imports / Libraries
- Declaration / init
- Functions
- main

#### Notes:
- Assume the role of a senior developer
- Always includes validation for arguments
- Always catch errors and do error handling
- refrain from code duplications
- Prefer one-liner if possible
- create test-cases to test functions
- use minimum external libraries as much as  possible
- functions generated should be concise and do only 1 responibility at a time
- Take consideration to Big O notation for performance purpose
- libraries used must not be deprecated
- adopt mvvm for applications
- create folders for files structuring
- md documentation should include the functions / application description as well
- for applications, always provides an exit execution


#### Appendix


- Language : react, nodejs

- Requirements : Create Front end component following the features listed below for the react module.

    - Menu Features
        - Menu Display
        : Create an organized menu interface with categories (appetizers, mains,desserts, beverages)
        - Item Management
        : Implement complete CRUD operations for menu items withdescriptions and prices
        - Image Upload
        : Add support for food photography and menu item images (manager+permission only)
        - Availability Control
        : Create functionality to mark items as available/unavailable(manager+ permission only)
        - Pricing Management
        : Implement dynamic pricing with the ability to set specials anddiscounts (manager+ permission only)
    - Scheduling Features
        - Weekly Schedule Creation
        : Allow managers to create and manage weekly staffschedules
        - Staff Assignment
        : Implement functionality to assign staff members to specific shiftsand roles (server, host, cleaner, etc.)
        - Shift Management
        : Create interface for creating, editing, and deleting shifts withspecific time slots
        - Schedule Viewing
        : Provide staff with ability to view their assigned schedules
        - Shift Coverage
        : Implement tracking for which shifts are covered and which need staffassignment
        - Weekly Overview
        : Create a visual calendar showing all staff assignments for the week
    - Analytics Features
        - Popular Items
        : Create analytics on most viewed or ordered menu items
        - Staff Scheduling Analytics
        : Implement tracking for schedule coverage and staffutilization
        - Menu Analytics
        : Add tracking for pricing and theoretical profits
        - System Usage Reports
        : Include tracking for user activity and system performance
- Libraries : Any up-to-date components that you deem fit that can achieve the required UI/UX

- Functions : should be referencing from flask modules for backend interactions. 

- Additionals :
    - Look and feel of the react app can take hint from https://preview.themeforest.net/item/delici-restaurant-react-template/full_screen_preview/42970412. 
    - App should be full-feature desktop experience but also mobile responsive. It should have cross browser compatibility as well.
    - JWT for session / token management
    - Error Messages: Implement clear, helpful error messages
    - Confirmation Dialogs: Add confirmation for destructive actions
    - Real-time Updates: Implement live updates for schedules and menu changes whenpossible
    - Loading States: Add proper loading indicators
    - Intuitive Navigation: Create a logical information architecture

#### Requirements stated are final and no follow up is required. You are allow to think for the requirement.