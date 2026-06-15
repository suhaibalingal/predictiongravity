#!/usr/bin/perl
# Simple Zero-Dependency Localhost HTTP Web Server in Perl
# Runs on any macOS system without Xcode, Node.js, or Python dependencies.
# Usage: perl server.pl [port] (default is 8000)

use strict;
use warnings;
use IO::Socket::INET;

$| = 1; # Enable autoflush for instant log printing

my $port = shift || 8000;
my $socket = IO::Socket::INET->new(
    LocalAddr => '127.0.0.1',
    LocalPort => $port,
    Proto     => 'tcp',
    Listen    => 5,
    Reuse     => 1
);

if (!$socket) {
    print STDERR "Error: Could not start server on port $port: $!\n";
    print STDERR "If the port is already in use, try running: perl server.pl 8080\n";
    exit 1;
}

print "========================================================\n";
print " FIFA World Cup 2026 Prediction Portal Local Server\n";
print "========================================================\n";
print "Server started successfully!\n";
print "👉 Open: http://127.0.0.1:$port/index.html (Student Portal)\n";
print "👉 Open: http://127.0.0.1:$port/admin.html (Admin Portal)\n";
print "========================================================\n";
print "Press Ctrl+C to stop the server.\n\n";

while (my $client = $socket->accept()) {
    my $request = <$client>;
    next unless $request;
    
    # Parse request: GET /path HTTP/1.1
    if ($request =~ m|^GET /([^ ]*) HTTP/|) {
        my $file = $1;
        # Default file is index.html
        if ($file eq "" || $file eq "/") {
            $file = "index.html";
        }
        
        # Simple security: prevent path traversal (../)
        $file =~ s|\.\./||g;
        
        if (-f $file) {
            # Determine Mime Type
            my $mime = "text/plain";
            if ($file =~ /\.html$/) { $mime = "text/html; charset=utf-8"; }
            elsif ($file =~ /\.css$/)  { $mime = "text/css; charset=utf-8"; }
            elsif ($file =~ /\.js$/)   { $mime = "application/javascript; charset=utf-8"; }
            elsif ($file =~ /\.png$/)  { $mime = "image/png"; }
            elsif ($file =~ /\.jpg$/ || $file =~ /\.jpeg$/) { $mime = "image/jpeg"; }
            elsif ($file =~ /\.ico$/)  { $mime = "image/x-icon"; }
            elsif ($file =~ /\.svg$/)  { $mime = "image/svg+xml; charset=utf-8"; }
            
            # Read file binary contents
            if (open(my $fh, '<:raw', $file)) {
                my $content = do { local $/; <$fh> };
                close($fh);
                
                print $client "HTTP/1.1 200 OK\r\n";
                print $client "Content-Type: $mime\r\n";
                print $client "Content-Length: " . length($content) . "\r\n";
                print $client "Connection: close\r\n\r\n";
                print $client $content;
                
                # Log request to console
                print "GET /$file - 200 OK\n";
            } else {
                print $client "HTTP/1.1 500 Internal Server Error\r\n";
                print $client "Content-Type: text/plain\r\n";
                print $client "Connection: close\r\n\r\n";
                print $client "Error reading file";
                print "GET /$file - 500 Internal Error ($!)\n";
            }
        } else {
            print $client "HTTP/1.1 404 Not Found\r\n";
            print $client "Content-Type: text/plain\r\n";
            print $client "Connection: close\r\n\r\n";
            print $client "File not found";
            print "GET /$file - 404 Not Found\n";
        }
    }
    close $client;
}
