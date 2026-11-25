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



# Phase 2: Payment Gateway Integration (Self-Service Kiosk Mode)
The photobooth will operate as a commercial self-service kiosk. We need to integrate a Payment Gateway module, specifically generating dynamic QR Codes (QRIS - Indonesian standard payment) for users to scan before the photo session begins.

# User Flow
1. User interacts with the touchscreen and selects a photo package.
2. The Electron frontend requests a transaction.
3. The Node.js backend calls the Payment Gateway API (e.g., Midtrans or Xendit) to generate a dynamic QR Code.
4. The QR Code is displayed on the frontend with a timeout timer (e.g., 5 minutes).
5. Once payment is successful, the UI automatically transitions to the DSLR Live View and starts the countdown.

# Technical Challenge & Constraints
The photobooth runs on a local Windows PC (behind NAT/Router) and does NOT have a public IP. Therefore, it cannot directly receive standard HTTP webhooks from the Payment Gateway when a payment succeeds. 

# Task 1: Architecture Solution for Payment Verification
Please propose the best approach to handle payment verification for a local machine. Consider and compare these two approaches:
- Approach A: HTTP Polling (The local Node.js backend polls the Payment Gateway's transaction status API every 3-5 seconds).
- Approach B: Cloud Relay (Using a lightweight cloud service like Firebase Realtime Database to receive the webhook, while the local Electron app listens to Firebase for real-time state changes). 

# Task 2: State Management & Hardware Safety
While waiting for payment, the Canon DSLR should remain in a safe standby state (Live View OFF) to prevent the sensor from overheating. 
Provide the logic/flow on how to manage the hardware state transitions: 
[Idle/Standby] -> [Generate QR & Wait for Payment] -> [Payment Success Trigger] -> [Wake Up Camera & Start Live View].