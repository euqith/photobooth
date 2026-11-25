buatkan planning untuk project photobooth dibawah ini. 
push epic, story, dan task ke github project board : https://github.com/euqith/photobooth.git

# Project Overview
I want to build a professional DSLR Photobooth application. The client requested a web-based UI, but to bypass browser limitations regarding direct USB DSLR control and silent printing, we will build a Local Desktop Web-App using Electron and a Node.js backend. 

# Target Environments & Hardware
Please take note of the cross-platform development and deployment pipeline:
1. Development: macOS (Apple Silicon) + Canon EOS 6D Mark I.
2. Testing: macOS & Windows + Canon EOS 6D Mark I.
3. Production: Windows (PC AIO Touchscreen i5 Gen 6) + Canon EOS 70D (with dummy battery) + Dedicated Photo Printer.

# Tech Stack Consideration
- Frontend: Web technologies (HTML, Tailwind CSS, JS/React) running in Electron (Kiosk/Fullscreen Touchscreen mode).
- Backend: Node.js / Express.
- Real-time Communication: Socket.io (for Live View streaming and hardware trigger sync).
- DSLR Bridging: Need a reliable solution/wrapper (e.g., gphoto2, EDSDK, or child_process CLI) that works on both macOS (for dev/test) and Windows (for prod).
- Printing: Node.js silent printing to Windows Print Spooler without native OS print dialogs.

# Task 1: Competitor Analysis & Feature Mapping
Before we write any code, act as a Photobooth System Architect. 
Please analyze industry-standard photobooth applications (such as DSLRBooth, Darkroom Booth, or Breeze). Based on your analysis, provide a detailed breakdown of:
1. Standard user flows for a touchscreen photobooth (from standby, live view countdown, photo capture, processing/layouting, to printing/sharing).
2. Must-have features for a modern photobooth (e.g., custom overlays/templates, retake options, GIF/Boomerang, QR code generation for digital download).
3. Best practices for handling DSLR states (standby vs capturing) to prevent camera crashes during long events.

# Task 2: Architecture Proposal
After the analysis, propose the best system architecture and node modules we should use to handle the Canon DSLR connection and silent printing seamlessly across both macOS (Dev) and Windows (Prod).

untuk template grid dan layout photo collage seperti pada folder template. Untuk video .mp4 yang ada pada folder template silahkan digunakan untuk splash screen atau loading screen atau apapun nantinya
