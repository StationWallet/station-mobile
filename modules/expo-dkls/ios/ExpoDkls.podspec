Pod::Spec.new do |s|
  s.name           = 'ExpoDkls'
  s.version        = '1.0.0'
  s.summary        = 'DKLS MPC signing for VultiAgent'
  s.description    = 'Expo native module wrapping godkls.xcframework for threshold signing'
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
  s.vendored_frameworks = "Frameworks/godkls.xcframework", "Frameworks/goschnorr.xcframework"
end
