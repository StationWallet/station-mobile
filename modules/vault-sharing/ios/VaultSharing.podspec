Pod::Spec.new do |s|
  s.name           = 'VaultSharing'
  s.version        = '1.0.0'
  s.summary        = 'Native file sharing with completion callbacks for VultiAgent'
  s.description    = 'Expo native module providing file sharing with proper completion detection'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "*.{h,m,mm,swift,hpp,cpp}"
end
